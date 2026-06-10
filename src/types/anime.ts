export type AnimeSeason = "WINTER" | "SPRING" | "SUMMER" | "FALL";

export type AnimeTitle = {
  romaji: string | null;
  english: string | null;
  native: string | null;
  userPreferred: string | null;
};

export type Studio = {
  id: number;
  name?: string;
};

export type NextAiringEpisode = {
  episode: number;
  airingAt: number;
  timeUntilAiring: number;
};

export type AnimeSummary = {
  id: number;
  idMal?: number | null;
  title?: AnimeTitle | null;
  coverImage?: string | null;
  bannerImage?: string | null;
  color?: string | null;
  format?: string | null;
  status?: string | null;
  source?: string | null;
  episodes?: number | null;
  duration?: number | null;
  season?: AnimeSeason | null;
  seasonYear?: number | null;
  startDate?: AnimeDate | null;
  averageScore?: number | null;
  meanScore?: number | null;
  popularity?: number | null;
  trending?: number | null;
  favourites?: number | null;
  genres?: string[];
  studios?: Studio[];
  nextAiringEpisode?: NextAiringEpisode | null;
  description?: string | null;
  airingCount?: number | null;
  dubCount?: number | null;
};

export type AiringItem = {
  episode: number;
  airingAt: number;
  timeUntilAiring: number;
  anime: AnimeSummary;
  source?: "anilist" | "anime_schedule";
  sourceLabel?: string;
  airingStatus?: string | null;
};

export type CharacterCredit = {
  id: number;
  name: string;
  nativeName?: string | null;
  image?: string | null;
  role?: string | null;
  voiceActors?: {
    japanese?: {
      id: number;
      name: string;
      image?: string | null;
    } | null;
    english?: {
      id: number;
      name: string;
      image?: string | null;
    } | null;
  } | null;
};

export type VoiceActorCredit = {
  id: number;
  name: string;
  image?: string | null;
};

export type RelationItem = {
  relationType: string;
  anime: AnimeSummary;
};

/** A single anime entry in the franchise relation graph. */
export type FranchiseNode = {
  anime: AnimeSummary;
  isRoot: boolean;
  /** Top-left position assigned by the layout pass. */
  x: number;
  y: number;
  width: number;
  height: number;
};

/** A connection between two franchise entries, oriented older -> newer. */
export type FranchiseEdge = {
  from: number;
  to: number;
  relationType: string;
};

/** The full connected franchise graph for a root anime. */
export type FranchiseGraph = {
  rootId: number;
  nodes: FranchiseNode[];
  edges: FranchiseEdge[];
  /** Overall layout bounds (filled by the layout pass). */
  width: number;
  height: number;
};

export type AnimeNotificationType = "episode" | "dub" | "upcoming" | "news";

/** A new-release notice for an anime on the user's list. */
export type AnimeNotification = {
  id: string;
  type: AnimeNotificationType;
  animeId: number;
  title: string;
  animeTitle?: string;
  coverImage: string | null;
  /** Lowest episode in the notice (the only episode when not grouped). */
  episode: number;
  /** Highest episode when several drops for one show are grouped into a range. */
  episodeTo?: number;
  /**
   * When the episode aired, epoch seconds. For `upcoming` reminders this is a
   * future timestamp (when the episode is scheduled to air). For a grouped
   * range this is the most recent episode's time.
   */
  airedAt: number;
  read: boolean;
};

export type ExternalLink = {
  id: number;
  site: string;
  url: string;
  type?: string | null;
  language?: string | null;
  color?: string | null;
};

export type StaffCredit = {
  id: number;
  name: string;
  role: string;
  image?: string | null;
};

export type AnimeDate = {
  year?: number | null;
  month?: number | null;
  day?: number | null;
};

export type MetadataProviderId =
  | "anilist"
  | "anizip"
  | "tvdb"
  | "tmdb"
  | "kitsu"
  | "generated"
  | "unknown";

export type MetadataConfidence = "high" | "medium" | "low";

export type EpisodeMetadataField =
  | "title"
  | "thumbnail"
  | "description"
  | "url"
  | "site";

export type EpisodeMetadataSource = {
  provider: MetadataProviderId;
  label: string;
  confidence: MetadataConfidence;
  fields: EpisodeMetadataField[];
};

export type MetadataSourceSummary = {
  provider: MetadataProviderId;
  label: string;
  role: "catalog" | "episode_metadata" | "image_metadata";
  confidence: MetadataConfidence;
};

export type AnimeStreamingEpisode = {
  number: number;
  title?: string | null;
  thumbnail?: string | null;
  url?: string | null;
  site?: string | null;
  description?: string | null;
  /** ISO date (yyyy-mm-dd) the episode aired; null when unknown. */
  airDate?: string | null;
  /** Full ISO timestamp (with time, UTC) the episode aired; null when unknown. */
  airDateTime?: string | null;
  /** Community rating on a 10-point scale; null when unknown. */
  rating?: number | null;
  sources?: EpisodeMetadataSource[];
};

export type DubInfo = {
  /** Dubbed episodes aired so far; null when unknown. */
  dubbedEpisodes: number | null;
  nextDubEpisode: NextAiringEpisode | null;
  totalEpisodes: number | null;
};

export type MalStats = {
  malId: number;
  /** MAL score normalized to 0-100 to match AniList's scale. */
  score: number | null;
  scoredBy: number | null;
  rank: number | null;
  popularity: number | null;
  members: number | null;
  favorites: number | null;
  url: string;
};

/** Filler/recap episode numbers sourced from MAL via Jikan. */
export type EpisodeFlags = {
  filler: number[];
  recap: number[];
};

/** A news article about an anime, sourced from MyAnimeList via Jikan. */
export type AnimeNewsArticle = {
  id: number;
  title: string;
  url: string;
  /** ISO timestamp of publication. */
  date: string;
  excerpt: string | null;
  imageUrl: string | null;
  author: string | null;
  authorUrl: string | null;
  forumUrl: string | null;
  comments: number | null;
};

export type AnimeDetails = AnimeSummary & {
  malStats?: MalStats | null;
  dubInfo?: DubInfo | null;
  /** Null when MAL has no episode list — unknown, not "no fillers". */
  episodeFlags?: EpisodeFlags | null;
  description?: string | null;
  source?: string | null;
  countryOfOrigin?: string | null;
  hashtag?: string | null;
  synonyms?: string[];
  startDate?: AnimeDate | null;
  endDate?: AnimeDate | null;
  streamingEpisodes?: AnimeStreamingEpisode[];
  trailer?: {
    id?: string | null;
    site?: string | null;
    thumbnail?: string | null;
  } | null;
  tags?: string[];
  rankings?: string[];
  characters?: CharacterCredit[];
  /** True when AniList has character pages beyond the first; the Cast tab
   *  lazy-loads the remainder client-side instead of blocking the render. */
  charactersHasNextPage?: boolean;
  staff?: StaffCredit[];
  relations?: RelationItem[];
  recommendations?: AnimeSummary[];
  externalLinks?: ExternalLink[];
  scoreDistribution?: ScoreBucket[];
  metadataSources?: MetadataSourceSummary[];
};

export type ScoreBucket = {
  score: number;
  amount: number;
};

export type HomeCollections = {
  topAiring: AnimeSummary[];
  trending: AnimeSummary[];
  season: AnimeSummary[];
  upcoming: AnimeSummary[];
  finished: AnimeSummary[];
  movies: AnimeSummary[];
  airingSoon: AiringItem[];
};

export type BrowseSectionKey =
  | "airing"
  | "trending"
  | "upcoming"
  | "finished"
  | "movies"
  | "search";

export type BrowsePageInfo = {
  total: number | null;
  currentPage: number;
  lastPage: number | null;
  hasNextPage: boolean;
  perPage: number;
};

export type BrowseFilters = {
  q: string;
  /** Comma-separated genres to require (genre_in). */
  genre: string;
  /** Comma-separated genres to exclude (genre_not_in). */
  genreExclude: string;
  format: string;
  /** Inclusive year range lower bound (YYYY); empty = open. */
  yearMin: string;
  /** Inclusive year range upper bound (YYYY); empty = open. */
  yearMax: string;
  sort: string;
  season: string;
  status: string;
  /** Comma-separated tags to require (tag_in). */
  tag: string;
  /** Comma-separated tags to exclude (tag_not_in). */
  tagExclude: string;
  country: string;
  source: string;
  /** Minimum average score (0-100). */
  scoreMin: string;
  /** Inclusive minimum episode count. */
  episodesMin: string;
  /** Inclusive maximum episode count. */
  episodesMax: string;
  /** Sort direction for browse/search result ordering. */
  sortOrder: string;
  /** Viewer-relative filter: "in" = on their list, "out" = not on it. */
  list: string;
  /** "1" restricts the visible page to titles with a known English dub
   *  (applied client-side over hydrated dub badges, so it is page-local). */
  dubbed: string;
};

export type BrowseFilterOption = {
  value: string;
  label: string;
};

export type BrowseFilterOptions = {
  genres: BrowseFilterOption[];
  tags: BrowseFilterOption[];
};

export type BrowseCollection = {
  items: AnimeSummary[];
  pageInfo: BrowsePageInfo;
};

export type ProviderHealth = {
  name: string;
  role: "metadata" | "tracking" | "streaming";
  status: "ready" | "needs_config" | "disabled";
  notes: string;
};
