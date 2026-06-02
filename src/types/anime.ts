export type AnimeSeason = "WINTER" | "SPRING" | "SUMMER" | "FALL";

export type AnimeTitle = {
  romaji: string | null;
  english: string | null;
  native: string | null;
  userPreferred: string | null;
};

export type Studio = {
  id: number;
  name: string;
};

export type NextAiringEpisode = {
  episode: number;
  airingAt: number;
  timeUntilAiring: number;
};

export type AnimeSummary = {
  id: number;
  idMal: number | null;
  title: AnimeTitle;
  coverImage: string | null;
  bannerImage: string | null;
  color: string | null;
  format: string | null;
  status: string | null;
  source: string | null;
  episodes: number | null;
  duration: number | null;
  season: AnimeSeason | null;
  seasonYear: number | null;
  averageScore: number | null;
  meanScore: number | null;
  popularity: number | null;
  trending: number | null;
  favourites: number | null;
  genres: string[];
  studios: Studio[];
  nextAiringEpisode: NextAiringEpisode | null;
  description?: string | null;
  airingCount?: number | null;
  dubCount?: number | null;
};

export type AiringItem = {
  episode: number;
  airingAt: number;
  timeUntilAiring: number;
  anime: AnimeSummary;
};

export type CharacterCredit = {
  id: number;
  name: string;
  nativeName: string | null;
  image: string | null;
  role: string | null;
  voiceActor: {
    id: number;
    name: string;
    image: string | null;
  } | null;
};

export type RelationItem = {
  relationType: string;
  anime: AnimeSummary;
};

export type ExternalLink = {
  id: number;
  site: string;
  url: string;
  type: string | null;
  language: string | null;
  color: string | null;
};

export type AnimeDetails = AnimeSummary & {
  description: string | null;
  source: string | null;
  countryOfOrigin: string | null;
  hashtag: string | null;
  trailer: {
    id: string | null;
    site: string | null;
    thumbnail: string | null;
  } | null;
  tags: string[];
  rankings: string[];
  characters: CharacterCredit[];
  relations: RelationItem[];
  recommendations: AnimeSummary[];
  externalLinks: ExternalLink[];
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
  | "movies";

export type ProviderHealth = {
  name: string;
  role: "metadata" | "tracking" | "streaming";
  status: "ready" | "needs_config" | "disabled";
  notes: string;
};
