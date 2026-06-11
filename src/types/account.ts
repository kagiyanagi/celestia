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
  whiteMode: boolean;
  hideAdultContent: boolean;
  autoplayTrailers: boolean;
  /** When enabled, episode progress and watch history are not recorded. */
  pauseHistory: boolean;
  /** Default audio track for playback. */
  defaultAudio: "sub" | "dub";
  /** Notify when a new subbed episode airs for a tracked show. */
  notifyEpisodes: boolean;
  /** Notify when a new dubbed episode drops for a tracked show. */
  notifyDubs: boolean;
  /** Notify shortly before a tracked show's next episode airs. */
  notifyUpcoming: boolean;
  /** Library statuses for which news notifications should be sent. */
  notifyNewsStatuses?: LibraryStatus[];
  /** When enabled, the profile is viewable by anyone at /u/[username]. */
  publicProfile: boolean;
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

export type FavoriteKind = "anime" | "character" | "voice_actor";

/** A favourited anime, character, or voice actor (snapshot for display). */
export type FavoriteItem = {
  kind: FavoriteKind;
  id: number;
  name: string;
  image: string | null;
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
  /** ISO timestamp of the last AniList → MiruCast library pull; gates re-sync frequency. */
  aniListSyncedAt?: string | null;
  preferences: UserPreferences;
  /** Anime ids the user has muted; no notifications are produced for them. */
  mutedAnimeIds?: number[];
  /** Favourited anime, characters, and voice actors. */
  favorites?: FavoriteItem[];
  devices: DeviceSession[];
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

/** A library entry as stored in the file DB, tagged with its owner. */
export type StoredLibraryEntry = LibraryEntry & { userId: string };
/** A history entry as stored in the file DB, tagged with its owner. */
export type StoredHistoryEntry = HistoryEntry & { userId: string };

export type AppDatabase = {
  users: UserRecord[];
  sessions: SessionRecord[];
  streamMappings?: StreamMappingRecord[];
  libraryEntries?: StoredLibraryEntry[];
  historyEntries?: StoredHistoryEntry[];
};

/**
 * The slim, stored view of a user: profile, preferences, auth, and derived
 * state — but NOT the library or watch history, which live in their own tables
 * and are read on demand. Session/auth reads return this, so the hot path never
 * transfers the (potentially large) tracking data.
 */
export type SessionUser = Omit<UserRecord, "passwordHash" | "aniListAccessToken">;

/**
 * The full client-facing view: a SessionUser with the user's library and watch
 * history assembled in. Returned by the session bootstrap and the mutation
 * endpoints whose responses the client folds straight into its auth context.
 */
export type PublicUser = SessionUser & {
  libraryEntries: LibraryEntry[];
  historyEntries: HistoryEntry[];
};

/** Read-only view of a user shown at /u/[username] when publicProfile is on. */
export type PublicProfileData = {
  displayName: string;
  username: string;
  pronouns: string;
  about: string;
  avatar: string | null;
  banner: string | null;
  joinedAt: string;
  aniListUrl: string | null;
  daysWatched: number | null;
  libraryEntries: LibraryEntry[];
  activity: SyncedActivity[];
  favorites: FavoriteItem[];
};
