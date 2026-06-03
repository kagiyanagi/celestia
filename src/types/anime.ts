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
  staff?: StaffCredit[];
  relations?: RelationItem[];
  recommendations?: AnimeSummary[];
  externalLinks?: ExternalLink[];
  metadataSources?: MetadataSourceSummary[];
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
  genre: string;
  format: string;
  year: string;
  sort: string;
  season: string;
  status: string;
  tag: string;
  country: string;
  source: string;
  /** Viewer-relative filter: "in" = on their list, "out" = not on it. */
  list: string;
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
