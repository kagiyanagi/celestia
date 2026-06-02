import { randomUUID } from "node:crypto";
import { readDb, writeDb } from "@/lib/db";
import type {
  AppDatabase,
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
  };
}

async function updateUserRecord<T>(
  userId: string,
  updater: (user: UserRecord, db: AppDatabase) => T | Promise<T>,
) {
  let result: T | undefined;

  await writeDb(async (db) => {
    const index = db.users.findIndex((user) => user.id === userId);

    if (index === -1) {
      throw new Error("User not found.");
    }

    const user = db.users[index];
    result = await updater(user, db);

    const nextUsers = [...db.users];
    nextUsers[index] = user;

    return {
      ...db,
      users: nextUsers,
    };
  });

  return result as T;
}

export async function getUserById(userId: string) {
  const db = await readDb();
  const user = db.users.find((entry) => entry.id === userId);
  return user ? sanitizeUser(user) : null;
}

export async function setAniListConnection(input: {
  userId: string;
  accessToken: string;
  profile: AniListProfile;
  libraryEntries: LibraryEntry[];
}) {
  return updateUserRecord(input.userId, (user) => {
    user.aniListAccessToken = input.accessToken;
    user.aniListProfile = input.profile;
    user.avatar = input.profile.avatar || user.avatar;
    user.banner = input.profile.banner || user.banner;
    user.displayName = input.profile.name || user.displayName;
    user.libraryEntries = mergeLibraryEntries(user.libraryEntries, input.libraryEntries);
    return sanitizeUser(user);
  });
}

export async function updateProfile(
  userId: string,
  profile: Partial<Pick<UserRecord, "displayName" | "username" | "pronouns" | "about">>,
) {
  return updateUserRecord(userId, (user, db) => {
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

      if (
        db.users.some(
          (entry) => entry.id !== userId && entry.username === username,
        )
      ) {
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

function mergeLibraryEntries(current: LibraryEntry[], incoming: LibraryEntry[]) {
  const map = new Map<number, LibraryEntry>();
  current.forEach((entry) => map.set(entry.animeId, entry));

  incoming.forEach((entry) => {
    const existing = map.get(entry.animeId);
    map.set(entry.animeId, {
      ...existing,
      ...entry,
      updatedAt: entry.updatedAt || existing?.updatedAt || new Date().toISOString(),
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
    const current = user.libraryEntries.find((entry) => entry.animeId === input.anime.id);
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
      ...user.libraryEntries.filter((entry) => entry.animeId !== input.anime.id),
    ];
    return nextEntry;
  });
}

export async function deleteLibraryEntry(userId: string, animeId: number) {
  return updateUserRecord(userId, (user) => {
    const removed = user.libraryEntries.find((entry) => entry.animeId === animeId) || null;
    user.libraryEntries = user.libraryEntries.filter((entry) => entry.animeId !== animeId);
    return removed;
  });
}

export async function recordHistory(input: {
  userId: string;
  anime: AnimeSummary;
  episode: number;
  episodeTitle: string;
  durationLabel: string | null;
  progressPercent: number;
}) {
  return updateUserRecord(input.userId, (user) => {
    const now = new Date().toISOString();
    const nextEntry: HistoryEntry = {
      id: createId(),
      animeId: input.anime.id,
      anime: input.anime,
      episode: input.episode,
      episodeTitle: input.episodeTitle,
      durationLabel: input.durationLabel,
      watchedAt: now,
      progressPercent: input.progressPercent,
    };

    user.historyEntries = [
      nextEntry,
      ...user.historyEntries.filter(
        (entry) =>
          !(entry.animeId === input.anime.id && entry.episode === input.episode),
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

export async function getPrivateUser(userId: string) {
  const db = await readDb();
  return db.users.find((entry) => entry.id === userId) || null;
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
