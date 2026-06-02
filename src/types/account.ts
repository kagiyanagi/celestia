import type { AnimeSummary } from "@/types/anime";

export type LibraryStatus =
  | "planning"
  | "watching"
  | "on_hold"
  | "dropped"
  | "completed"
  | "rewatching";

export type UserPreferences = {
  titleLanguage: "english" | "romaji" | "native";
  hideAdultContent: boolean;
  autoplayTrailers: boolean;
  videoQuality: "auto" | "higher_picture_quality" | "data_saver";
  autoPlay: boolean;
  autoNext: boolean;
  autoSkipIntroOutro: boolean;
  miniPlayer: boolean;
};

export type DeviceSession = {
  id: string;
  label: string;
  platform: string;
  browser: string;
  locationLabel: string;
  lastActiveAt: string;
  current: boolean;
};

export type AniListProfile = {
  id: number;
  name: string;
  avatar: string | null;
  banner: string | null;
  about: string | null;
  siteUrl: string | null;
  daysWatched: number;
  animeCompleted: number;
  animeCount: number;
  activity: SyncedActivity[];
};

export type SyncedActivity = {
  id: string;
  animeId: number;
  coverImage: string | null;
  animeTitle: string;
  progress: number;
  createdAt: string;
  source: "anilist" | "local";
};

export type LibraryEntry = {
  id: string;
  animeId: number;
  anime: AnimeSummary;
  status: LibraryStatus;
  score: number;
  progress: number;
  repeat: number;
  notes: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  aniListEntryId: number | null;
};

export type HistoryEntry = {
  id: string;
  animeId: number;
  anime: AnimeSummary;
  episode: number;
  episodeTitle: string;
  durationLabel: string | null;
  watchedAt: string;
  progressPercent: number;
};

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  username: string;
  pronouns: string;
  about: string;
  avatar: string | null;
  banner: string | null;
  joinedAt: string;
  aniListAccessToken: string | null;
  aniListProfile: AniListProfile | null;
  preferences: UserPreferences;
  devices: DeviceSession[];
  libraryEntries: LibraryEntry[];
  historyEntries: HistoryEntry[];
};

export type SessionRecord = {
  id: string;
  userId: string;
  createdAt: string;
  lastSeenAt: string;
  userAgent: string;
};

export type AppDatabase = {
  users: UserRecord[];
  sessions: SessionRecord[];
};

export type PublicUser = Omit<UserRecord, "passwordHash" | "aniListAccessToken">;
