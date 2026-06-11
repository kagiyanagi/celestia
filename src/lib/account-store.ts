import { randomUUID } from "node:crypto";
import { cache } from "react";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "@/lib/crypto";
import { getStore } from "@/lib/db";
import type {
  AniListProfile,
  FavoriteItem,
  HistoryEntry,
  LibraryEntry,
  LibraryStatus,
  PublicProfileData,
  PublicUser,
  SessionUser,
  UserPreferences,
  UserRecord,
} from "@/types/account";
import type { AnimeSummary } from "@/types/anime";

function createId() {
  return randomUUID();
}

/**
 * Request-scoped memo of a raw user record by id. React's cache() dedupes
 * within a single request, so the session lookup (auth.ts), getPublicUser, and
 * every updateUserRecord read in one request share ONE database round-trip
 * instead of each re-fetching the user row. The cached object is the same
 * reference an in-place mutation writes back, so sequential mutations in one
 * request accumulate correctly.
 */
export const getCachedUserRecord = cache((id: string) =>
  getStore().getUserById(id),
);

/**
 * Request-scoped library/history reads. Library and history live in their own
 * tables (not on the user row), so they are only fetched when a caller actually
 * needs them — the hot auth path never transfers them. cache() dedupes repeat
 * reads within a single request.
 */
const getCachedLibrary = cache((id: string) =>
  getStore().listLibraryEntries(id),
);
const getCachedHistory = cache((id: string) =>
  getStore().listHistoryEntries(id),
);

export function getLibraryEntries(userId: string): Promise<LibraryEntry[]> {
  return getCachedLibrary(userId);
}

export function getHistoryEntries(userId: string): Promise<HistoryEntry[]> {
  return getCachedHistory(userId);
}

/** A single library entry by anime id, or null — a scoped single-row read. */
export function getLibraryEntry(userId: string, animeId: number) {
  return getStore().getLibraryEntry(userId, animeId);
}

/** The redacted, library/history-free view returned by session/auth reads. */
function sanitizeSessionUser(user: UserRecord): SessionUser {
  return {
    id: user.id,
    isGuest: user.isGuest,
    email: user.email,
    displayName: user.displayName,
    username: user.username,
    pronouns: user.pronouns,
    about: user.about,
    avatar: user.avatar,
    banner: user.banner,
    joinedAt: user.joinedAt,
    aniListProfile: user.aniListProfile,
    aniListSyncedAt: user.aniListSyncedAt ?? null,
    preferences: user.preferences,
    mutedAnimeIds: user.mutedAnimeIds ?? [],
    favorites: user.favorites ?? [],
    devices: user.devices,
    notificationsLastReadAt: user.notificationsLastReadAt ?? null,
    notificationReadIds: user.notificationReadIds ?? [],
    notificationDismissedIds: user.notificationDismissedIds ?? [],
  };
}

/** Assembles the full client view from a known user + its tracking data. */
function toPublicUser(
  user: UserRecord,
  libraryEntries: LibraryEntry[],
  historyEntries: HistoryEntry[],
): PublicUser {
  return { ...sanitizeSessionUser(user), libraryEntries, historyEntries };
}

/** Assembles the full client view, fetching the user's library/history. */
async function publicUserFrom(user: UserRecord): Promise<PublicUser> {
  const [libraryEntries, historyEntries] = await Promise.all([
    getCachedLibrary(user.id),
    getCachedHistory(user.id),
  ]);
  return toPublicUser(user, libraryEntries, historyEntries);
}

// Cap persisted per-notification state. Notifications leave the 30-day window
// on their own, so old ids can never reappear — this is just a runaway guard.
const MAX_NOTIFICATION_STATE = 500;

function appendBoundedIds(current: string[] | undefined, ids: string[]) {
  const merged = new Set(current ?? []);
  ids.forEach((id) => merged.add(id));
  const list = Array.from(merged);
  return list.length > MAX_NOTIFICATION_STATE
    ? list.slice(list.length - MAX_NOTIFICATION_STATE)
    : list;
}

async function updateUserRecord<T>(
  userId: string,
  updater: (user: UserRecord) => T | Promise<T>,
) {
  const store = getStore();
  const user = await getCachedUserRecord(userId);

  if (!user) {
    throw new Error("User not found.");
  }

  const result = await updater(user);
  await store.updateUser(user);

  return result;
}

export async function getPublicProfile(
  username: string,
): Promise<PublicProfileData | null> {
  const normalized = username.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const store = getStore();
  const user = await store.getUserByUsername(normalized);
  if (!user || !user.preferences.publicProfile) {
    return null;
  }

  const libraryEntries = await store.listLibraryEntries(user.id);

  return {
    displayName: user.displayName,
    username: user.username,
    pronouns: user.pronouns,
    about: user.about || user.aniListProfile?.about || "",
    avatar: user.avatar,
    banner: user.banner,
    joinedAt: user.joinedAt,
    aniListUrl: user.aniListProfile?.siteUrl ?? null,
    daysWatched: user.aniListProfile?.daysWatched ?? null,
    libraryEntries,
    activity: user.aniListProfile?.activity ?? [],
    favorites: user.favorites ?? [],
  };
}

/** Full client view of a user (profile + library + history), or null. */
export async function getPublicUser(
  userId: string,
): Promise<PublicUser | null> {
  const user = await getCachedUserRecord(userId);
  return user ? publicUserFrom(user) : null;
}

export function getUserById(userId: string) {
  return getPublicUser(userId);
}

export async function setAniListConnection(input: {
  userId: string;
  accessToken: string;
  profile: AniListProfile;
  libraryEntries: LibraryEntry[];
}) {
  const store = getStore();

  const user = await updateUserRecord(input.userId, (user) => {
    user.isGuest = false;
    // OAuth tokens are encrypted at rest; see src/lib/crypto.ts.
    user.aniListAccessToken = encryptSecret(input.accessToken);
    user.aniListProfile = input.profile;
    user.avatar = input.profile.avatar || user.avatar;
    user.banner = input.profile.banner || user.banner;
    user.displayName = input.profile.name || user.displayName;
    if (!user.about || user.about.trim() === "") {
      user.about = input.profile.about || "";
    }
    return user;
  });

  const existing = await store.listLibraryEntries(input.userId);
  const merged = mergeLibraryEntries(existing, input.libraryEntries);
  await store.saveLibraryEntries(input.userId, merged);

  const historyEntries = await store.listHistoryEntries(input.userId);
  return toPublicUser(user, merged, historyEntries);
}

export async function updateProfile(
  userId: string,
  profile: Partial<
    Pick<UserRecord, "displayName" | "username" | "pronouns" | "about">
  >,
) {
  const store = getStore();

  return updateUserRecord(userId, async (user) => {
    if (profile.displayName !== undefined) {
      const displayName = profile.displayName.trim();

      if (!displayName) {
        throw new Error("Display name is required.");
      }

      user.displayName = displayName;
    }
    if (profile.username !== undefined) {
      const username = profile.username.trim().toLowerCase();

      if (!/^[a-z0-9_][a-z0-9_-]{2,29}$/.test(username)) {
        throw new Error(
          "Username must be 3-30 characters and use letters, numbers, underscores, or hyphens.",
        );
      }

      if (await store.isUsernameTaken(username, userId)) {
        throw new Error("That username is already taken.");
      }

      user.username = username;
    }
    if (profile.pronouns !== undefined) {
      user.pronouns = profile.pronouns.trim();
    }
    if (profile.about !== undefined) {
      user.about = profile.about.trim();
    }
    return publicUserFrom(user);
  });
}

export async function updatePreferences(
  userId: string,
  preferences: Partial<UserPreferences>,
) {
  return updateUserRecord(userId, (user) => {
    user.preferences = {
      ...user.preferences,
      ...preferences,
    };
    return publicUserFrom(user);
  });
}

const MAX_FAVORITES_PER_KIND = 100;

/**
 * Adds the favourite if absent, removes it when already present (keyed by
 * kind+id). Returns the updated user so callers can confirm state.
 */
export async function toggleFavorite(userId: string, item: FavoriteItem) {
  return updateUserRecord(userId, (user) => {
    const current = user.favorites ?? [];
    const exists = current.some(
      (fav) => fav.kind === item.kind && fav.id === item.id,
    );

    if (exists) {
      user.favorites = current.filter(
        (fav) => !(fav.kind === item.kind && fav.id === item.id),
      );
    } else {
      const sameKind = current.filter((fav) => fav.kind === item.kind);
      if (sameKind.length >= MAX_FAVORITES_PER_KIND) {
        throw new Error(`You can favourite up to ${MAX_FAVORITES_PER_KIND}.`);
      }
      user.favorites = [item, ...current];
    }

    return publicUserFrom(user);
  });
}

export async function setAnimeMuted(
  userId: string,
  animeId: number,
  muted: boolean,
) {
  return updateUserRecord(userId, (user) => {
    const current = new Set(user.mutedAnimeIds ?? []);
    if (muted) {
      current.add(animeId);
    } else {
      current.delete(animeId);
    }
    user.mutedAnimeIds = Array.from(current);
    return sanitizeSessionUser(user);
  });
}

function mergeLibraryEntries(
  current: LibraryEntry[],
  incoming: LibraryEntry[],
) {
  const map = new Map<number, LibraryEntry>();
  current.forEach((entry) => map.set(entry.animeId, entry));

  incoming.forEach((entry) => {
    const existing = map.get(entry.animeId);
    map.set(entry.animeId, {
      ...existing,
      ...entry,
      addedAt:
        existing?.addedAt || entry.addedAt || new Date().toISOString(),
      updatedAt:
        entry.updatedAt || existing?.updatedAt || new Date().toISOString(),
    });
  });

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

/**
 * Reconciles a fresh AniList pull into the local library with newest-wins
 * semantics. Unlike mergeLibraryEntries (incoming always wins — used for the
 * initial connect and XML import), this compares updatedAt so a local edit that
 * hasn't pushed yet is not clobbered by an older AniList entry. Local-only
 * entries (never on AniList) are preserved; removals on AniList are not mirrored
 * (a local-only entry would look identical to a remotely-deleted one).
 */
function mergeAniListPull(current: LibraryEntry[], incoming: LibraryEntry[]) {
  const map = new Map<number, LibraryEntry>();
  current.forEach((entry) => map.set(entry.animeId, entry));

  incoming.forEach((remote) => {
    const local = map.get(remote.animeId);

    if (!local) {
      map.set(remote.animeId, remote);
      return;
    }

    const localTime = new Date(local.updatedAt).getTime() || 0;
    const remoteTime = new Date(remote.updatedAt).getTime() || 0;

    if (remoteTime >= localTime) {
      map.set(remote.animeId, {
        ...remote,
        id: local.id,
        addedAt: local.addedAt || remote.addedAt || null,
        aniListEntryId: remote.aniListEntryId ?? local.aniListEntryId,
      });
    }
  });

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

/**
 * Folds AniList list-activity ("watched episode N") into local watch history so
 * episodes marked watched on AniList surface in MiruCast. A native MiruCast
 * watch for the same anime+episode always wins (it carries the real still/title
 * and an actual local watch), so this only fills gaps. AniList exposes no
 * per-episode still or title, so those stay empty and the card falls back to
 * the cover art.
 *
 * AniList-derived entries (id prefixed `anilist-`) are fully re-derived from the
 * current activity feed each sync rather than accreted: the prior ones are
 * dropped and rebuilt. This keeps them in step with AniList and self-heals any
 * stale data — notably entries left by an earlier unscoped pull that mistook
 * AniList's global feed for the viewer's. Native watches (UUID ids) are kept.
 */
function mergeAniListHistory(
  current: HistoryEntry[],
  profile: AniListProfile,
  libraryEntries: LibraryEntry[],
) {
  const native = current.filter((entry) => !entry.id.startsWith("anilist-"));
  const seen = new Set(
    native.map((entry) => `${entry.animeId}:${entry.episode}`),
  );
  const animeById = new Map(
    libraryEntries.map((entry) => [entry.animeId, entry.anime]),
  );
  const additions: HistoryEntry[] = [];

  profile.activity
    .filter((item) => item.source === "anilist" && item.progress > 0)
    .forEach((item) => {
      const key = `${item.animeId}:${item.progress}`;
      const anime = animeById.get(item.animeId);

      // No catalog entry → no AnimeSummary to render the card with; skip.
      if (!anime || seen.has(key)) {
        return;
      }

      seen.add(key);
      additions.push({
        id: item.id,
        animeId: item.animeId,
        anime,
        episode: item.progress,
        episodeTitle: `Episode ${item.progress}`,
        episodeImage: null,
        durationLabel: null,
        watchedAt: item.createdAt,
        // Marking an episode watched on AniList means it was finished.
        progressPercent: 100,
      });
    });

  return [...native, ...additions]
    .sort(
      (a, b) =>
        new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime(),
    )
    .slice(0, 120);
}

/**
 * Applies a pulled AniList snapshot (library + refreshed profile) to the user,
 * reconciling entries newest-wins, folding activity into history, and stamping
 * the sync time. Caller owns the remote fetch; this is the local write half so
 * it can stay in account-store. Library writes are diffed so a routine sync
 * only touches entries that actually changed.
 */
export async function applyAniListSync(input: {
  userId: string;
  profile: AniListProfile;
  libraryEntries: LibraryEntry[];
}) {
  const store = getStore();

  const user = await updateUserRecord(input.userId, (user) => {
    user.aniListProfile = input.profile;
    user.avatar = input.profile.avatar || user.avatar;
    user.banner = input.profile.banner || user.banner;
    if (!user.about || user.about.trim() === "") {
      user.about = input.profile.about || "";
    }
    user.aniListSyncedAt = new Date().toISOString();
    return user;
  });

  const existingLibrary = await store.listLibraryEntries(input.userId);
  const mergedLibrary = mergeAniListPull(existingLibrary, input.libraryEntries);

  const existingByAnime = new Map(
    existingLibrary.map((entry) => [entry.animeId, entry]),
  );
  for (const entry of mergedLibrary) {
    const prev = existingByAnime.get(entry.animeId);
    if (
      !prev ||
      prev.updatedAt !== entry.updatedAt ||
      prev.status !== entry.status ||
      prev.progress !== entry.progress ||
      prev.score !== entry.score ||
      prev.aniListEntryId !== entry.aniListEntryId
    ) {
      await store.saveLibraryEntry(input.userId, entry);
    }
  }

  let historyEntries = await store.listHistoryEntries(input.userId);
  if (!user.preferences.pauseHistory) {
    historyEntries = mergeAniListHistory(
      historyEntries,
      input.profile,
      mergedLibrary,
    );
    await store.replaceHistoryEntries(input.userId, historyEntries);
  }

  return toPublicUser(user, mergedLibrary, historyEntries);
}

export async function upsertLibraryEntry(input: {
  userId: string;
  anime: AnimeSummary;
  status: LibraryStatus;
  score: number;
  progress: number;
  repeat: number;
  notes: string;
  startedAt: string | null;
  completedAt: string | null;
  aniListEntryId?: number | null;
}) {
  const store = getStore();
  const now = new Date().toISOString();
  const current = await store.getLibraryEntry(input.userId, input.anime.id);
  const nextEntry: LibraryEntry = {
    id: current?.id || createId(),
    animeId: input.anime.id,
    anime: input.anime,
    status: input.status,
    score: input.score,
    progress: input.progress,
    repeat: input.repeat,
    notes: input.notes,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    updatedAt: now,
    addedAt: current?.addedAt || now,
    aniListEntryId: input.aniListEntryId ?? current?.aniListEntryId ?? null,
  };

  await store.saveLibraryEntry(input.userId, nextEntry);
  return nextEntry;
}

/**
 * Bulk-imports library entries (e.g. from a MAL/AniList XML upload) in a single
 * write. Reuses mergeLibraryEntries so existing entries are preserved and the
 * newer updatedAt wins, matching AniList sync semantics.
 */
export async function importLibraryEntries(
  userId: string,
  entries: LibraryEntry[],
) {
  const store = getStore();
  const existing = await store.listLibraryEntries(userId);
  const merged = mergeLibraryEntries(existing, entries);
  await store.saveLibraryEntries(userId, merged);
  return merged.length;
}

export async function deleteLibraryEntry(userId: string, animeId: number) {
  return getStore().removeLibraryEntry(userId, animeId);
}

export async function recordHistory(input: {
  userId: string;
  anime: AnimeSummary;
  episode: number;
  episodeTitle: string;
  episodeImage: string | null;
  durationLabel: string | null;
  progressPercent: number;
}) {
  const store = getStore();
  const now = new Date().toISOString();
  const existing = await store.getHistoryEntry(
    input.userId,
    input.anime.id,
    input.episode,
  );
  const nextEntry: HistoryEntry = {
    id: existing?.id || createId(),
    animeId: input.anime.id,
    anime: input.anime,
    episode: input.episode,
    episodeTitle: input.episodeTitle,
    episodeImage: input.episodeImage || existing?.episodeImage || null,
    durationLabel: input.durationLabel,
    watchedAt: now,
    // Progress only moves forward — a quick revisit must not wipe it.
    progressPercent: Math.max(
      input.progressPercent,
      existing?.progressPercent ?? 0,
    ),
  };

  await store.saveHistoryEntry(input.userId, nextEntry);
  return nextEntry;
}

export async function deleteHistoryEntry(userId: string, entryId: string) {
  return getStore().removeHistoryEntry(userId, entryId);
}

export async function clearHistory(userId: string) {
  const store = getStore();
  await store.clearHistoryEntries(userId);

  const user = await getCachedUserRecord(userId);
  if (!user) {
    throw new Error("User not found.");
  }
  return toPublicUser(user, await getCachedLibrary(userId), []);
}

export async function deleteAccount(userId: string) {
  await getStore().deleteUser(userId);
}

/**
 * Marks notifications read. With no ids, marks everything read via a single
 * timestamp; with ids, records just those (so "tick one read" persists without
 * touching the rest). Returns the slim user — callers use it for confirmation
 * only and must not fold it into client state wholesale (it has no library).
 */
export async function markNotificationsRead(userId: string, ids?: string[]) {
  return updateUserRecord(userId, (user) => {
    if (ids && ids.length > 0) {
      user.notificationReadIds = appendBoundedIds(user.notificationReadIds, ids);
    } else {
      user.notificationsLastReadAt = new Date().toISOString();
    }
    return sanitizeSessionUser(user);
  });
}

/** Dismisses (deletes) notifications by id so they stay hidden in-window. */
export async function dismissNotifications(userId: string, ids: string[]) {
  return updateUserRecord(userId, (user) => {
    user.notificationDismissedIds = appendBoundedIds(
      user.notificationDismissedIds,
      ids,
    );
    return sanitizeSessionUser(user);
  });
}

/**
 * Returns the full user record with the AniList token decrypted for use.
 * Library and history are NOT included — fetch them with getLibraryEntries /
 * getHistoryEntries when needed. Legacy plaintext tokens are re-encrypted in
 * storage on first read.
 */
export async function getPrivateUser(userId: string) {
  const store = getStore();
  const user = await getCachedUserRecord(userId);

  if (!user) {
    return null;
  }

  if (user.aniListAccessToken && !isEncryptedSecret(user.aniListAccessToken)) {
    const plaintext = user.aniListAccessToken;
    user.aniListAccessToken = encryptSecret(plaintext);
    await store.updateUser(user);
    return { ...user, aniListAccessToken: plaintext };
  }

  return {
    ...user,
    aniListAccessToken: decryptSecret(user.aniListAccessToken),
  };
}
