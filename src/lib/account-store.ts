import { randomUUID } from "node:crypto";
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
  UserPreferences,
  UserRecord,
} from "@/types/account";
import type { AnimeSummary } from "@/types/anime";

function createId() {
  return randomUUID();
}

function sanitizeUser(user: UserRecord): PublicUser {
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
    libraryEntries: user.libraryEntries,
    historyEntries: user.historyEntries,
    notificationsLastReadAt: user.notificationsLastReadAt ?? null,
    notificationReadIds: user.notificationReadIds ?? [],
    notificationDismissedIds: user.notificationDismissedIds ?? [],
  };
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
  const user = await store.getUserById(userId);

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

  const user = await getStore().getUserByUsername(normalized);
  if (!user || !user.preferences.publicProfile) {
    return null;
  }

  return {
    displayName: user.displayName,
    username: user.username,
    pronouns: user.pronouns,
    about: user.about,
    avatar: user.avatar,
    banner: user.banner,
    joinedAt: user.joinedAt,
    aniListUrl: user.aniListProfile?.siteUrl ?? null,
    daysWatched: user.aniListProfile?.daysWatched ?? null,
    libraryEntries: user.libraryEntries,
    activity: user.aniListProfile?.activity ?? [],
    favorites: user.favorites ?? [],
  };
}

export async function getUserById(userId: string) {
  const user = await getStore().getUserById(userId);
  return user ? sanitizeUser(user) : null;
}

export async function setAniListConnection(input: {
  userId: string;
  accessToken: string;
  profile: AniListProfile;
  libraryEntries: LibraryEntry[];
}) {
  return updateUserRecord(input.userId, (user) => {
    user.isGuest = false;
    // OAuth tokens are encrypted at rest; see src/lib/crypto.ts.
    user.aniListAccessToken = encryptSecret(input.accessToken);
    user.aniListProfile = input.profile;
    user.avatar = input.profile.avatar || user.avatar;
    user.banner = input.profile.banner || user.banner;
    user.displayName = input.profile.name || user.displayName;
    user.libraryEntries = mergeLibraryEntries(
      user.libraryEntries,
      input.libraryEntries,
    );
    return sanitizeUser(user);
  });
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
    return sanitizeUser(user);
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
    return sanitizeUser(user);
  });
}

const MAX_FAVORITES_PER_KIND = 100;

/**
 * Adds the favourite if absent, removes it when already present (keyed by
 * kind+id). Returns the updated favourites list so callers can confirm state.
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

    return sanitizeUser(user);
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
    return sanitizeUser(user);
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
 * episodes marked watched on AniList surface in Celestia. A native Celestia
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
 * it can stay in account-store.
 */
export async function applyAniListSync(input: {
  userId: string;
  profile: AniListProfile;
  libraryEntries: LibraryEntry[];
}) {
  return updateUserRecord(input.userId, (user) => {
    user.aniListProfile = input.profile;
    user.avatar = input.profile.avatar || user.avatar;
    user.banner = input.profile.banner || user.banner;
    user.libraryEntries = mergeAniListPull(
      user.libraryEntries,
      input.libraryEntries,
    );
    if (!user.preferences.pauseHistory) {
      user.historyEntries = mergeAniListHistory(
        user.historyEntries,
        input.profile,
        user.libraryEntries,
      );
    }
    user.aniListSyncedAt = new Date().toISOString();
    return sanitizeUser(user);
  });
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
  return updateUserRecord(input.userId, (user) => {
    const now = new Date().toISOString();
    const current = user.libraryEntries.find(
      (entry) => entry.animeId === input.anime.id,
    );
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

    user.libraryEntries = [
      nextEntry,
      ...user.libraryEntries.filter(
        (entry) => entry.animeId !== input.anime.id,
      ),
    ];
    return nextEntry;
  });
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
  return updateUserRecord(userId, (user) => {
    user.libraryEntries = mergeLibraryEntries(user.libraryEntries, entries);
    return user.libraryEntries.length;
  });
}

export async function deleteLibraryEntry(userId: string, animeId: number) {
  return updateUserRecord(userId, (user) => {
    const removed =
      user.libraryEntries.find((entry) => entry.animeId === animeId) || null;
    user.libraryEntries = user.libraryEntries.filter(
      (entry) => entry.animeId !== animeId,
    );
    return removed;
  });
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
  return updateUserRecord(input.userId, (user) => {
    const now = new Date().toISOString();
    const existing = user.historyEntries.find(
      (entry) =>
        entry.animeId === input.anime.id && entry.episode === input.episode,
    );
    const nextEntry: HistoryEntry = {
      id: createId(),
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

    user.historyEntries = [
      nextEntry,
      ...user.historyEntries.filter(
        (entry) =>
          !(
            entry.animeId === input.anime.id && entry.episode === input.episode
          ),
      ),
    ].slice(0, 120);

    return nextEntry;
  });
}

export async function deleteHistoryEntry(userId: string, entryId: string) {
  return updateUserRecord(userId, (user) => {
    const removed =
      user.historyEntries.find((entry) => entry.id === entryId) || null;
    user.historyEntries = user.historyEntries.filter(
      (entry) => entry.id !== entryId,
    );
    return removed;
  });
}

export async function clearHistory(userId: string) {
  return updateUserRecord(userId, (user) => {
    user.historyEntries = [];
    return sanitizeUser(user);
  });
}

export async function deleteAccount(userId: string) {
  await getStore().deleteUser(userId);
}

/**
 * Marks notifications read. With no ids, marks everything read via a single
 * timestamp; with ids, records just those (so "tick one read" persists without
 * touching the rest).
 */
export async function markNotificationsRead(userId: string, ids?: string[]) {
  return updateUserRecord(userId, (user) => {
    if (ids && ids.length > 0) {
      user.notificationReadIds = appendBoundedIds(user.notificationReadIds, ids);
    } else {
      user.notificationsLastReadAt = new Date().toISOString();
    }
    return sanitizeUser(user);
  });
}

/** Dismisses (deletes) notifications by id so they stay hidden in-window. */
export async function dismissNotifications(userId: string, ids: string[]) {
  return updateUserRecord(userId, (user) => {
    user.notificationDismissedIds = appendBoundedIds(
      user.notificationDismissedIds,
      ids,
    );
    return sanitizeUser(user);
  });
}

/**
 * Returns the full user record with the AniList token decrypted for use.
 * Legacy plaintext tokens are re-encrypted in storage on first read.
 */
export async function getPrivateUser(userId: string) {
  const store = getStore();
  const user = await store.getUserById(userId);

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

export async function refreshAniListProfile(
  userId: string,
  profile: AniListProfile,
) {
  return updateUserRecord(userId, (user) => {
    user.aniListProfile = profile;
    user.avatar = profile.avatar || user.avatar;
    user.banner = profile.banner || user.banner;
    return sanitizeUser(user);
  });
}
