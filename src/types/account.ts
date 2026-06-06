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
  /** When enabled, episode progress and watch history are not recorded. */
  pauseHistory: boolean;
  /** Default audio track for playback. */
  defaultAudio: "sub" | "dub";
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
  /**
   * ISO timestamp the entry was first added to the library. Notifications only
   * cover episodes that aired at/after this, so adding an anime never backfills
   * the whole recent window. Entries saved before this field existed have none.
   */
  addedAt?: string | null;
  aniListEntryId: number | null;
};

export type HistoryEntry = {
  id: string;
  animeId: number;
  anime: AnimeSummary;
  episode: number;
  episodeTitle: string;
  /** Episode still from metadata providers; entries saved before this field existed have none. */
  episodeImage?: string | null;
  durationLabel: string | null;
  watchedAt: string;
  progressPercent: number;
};

export type UserRecord = {
  id: string;
  isGuest: boolean;
  email: string | null;
  passwordHash: string | null;
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
  /** ISO timestamp the user last marked all notifications as read. */
  notificationsLastReadAt?: string | null;
  /** Notification ids individually marked read (read state is otherwise derived). */
  notificationReadIds?: string[];
  /** Notification ids the user dismissed; hidden even while still in the window. */
  notificationDismissedIds?: string[];
};

export type SessionRecord = {
  id: string;
  userId: string;
  createdAt: string;
  lastSeenAt: string;
  userAgent: string;
};

export type StreamMappingRecord = {
  anilistId: number;
  providerId: string;
  providerAnimeId: number;
  episodeCount: number | null;
  /** Alignment score recorded when the mapping was verified. */
  score: number;
  verifiedAt: string;
};

export type AppDatabase = {
  users: UserRecord[];
  sessions: SessionRecord[];
  streamMappings?: StreamMappingRecord[];
};

export type PublicUser = Omit<
  UserRecord,
  "passwordHash" | "aniListAccessToken"
>;
