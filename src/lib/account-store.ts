import { randomUUID } from "node:crypto";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "@/lib/crypto";
import { getStore } from "@/lib/db";
import type {
  AniListProfile,
  HistoryEntry,
  LibraryEntry,
  LibraryStatus,
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
    preferences: user.preferences,
    devices: user.devices,
    libraryEntries: user.libraryEntries,
    historyEntries: user.historyEntries,
    notificationsLastReadAt: user.notificationsLastReadAt ?? null,
  };
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
      updatedAt:
        entry.updatedAt || existing?.updatedAt || new Date().toISOString(),
    });
  });

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
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

export async function clearHistory(userId: string) {
  return updateUserRecord(userId, (user) => {
    user.historyEntries = [];
    return sanitizeUser(user);
  });
}

export async function markNotificationsRead(userId: string) {
  return updateUserRecord(userId, (user) => {
    user.notificationsLastReadAt = new Date().toISOString();
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
