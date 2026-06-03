import { parsePageParam, type PaginationSearchParams } from "@/lib/pagination";
import type {
  BrowseFilterOption,
  BrowseFilters,
  BrowseSectionKey,
} from "@/types/anime";

export type BrowseSearchParams = PaginationSearchParams & {
  q?: string | string[];
  genre?: string | string[];
  format?: string | string[];
  year?: string | string[];
  sort?: string | string[];
  season?: string | string[];
  status?: string | string[];
  tag?: string | string[];
  country?: string | string[];
  source?: string | string[];
  list?: string | string[];
};

export type ParsedBrowseParams = {
  page: number;
  filters: BrowseFilters;
};

export const EMPTY_BROWSE_FILTERS: BrowseFilters = {
  q: "",
  genre: "",
  format: "",
  year: "",
  sort: "",
  season: "",
  status: "",
  tag: "",
  country: "",
  source: "",
  list: "",
};

export const LIST_OPTIONS: BrowseFilterOption[] = [
  { value: "in", label: "In your list" },
  { value: "out", label: "Not in your list" },
];

export const FORMAT_OPTIONS: BrowseFilterOption[] = [
  { value: "MOVIE", label: "Movie" },
  { value: "TV", label: "TV" },
  { value: "TV_SHORT", label: "TV Short" },
  { value: "SPECIAL", label: "Special" },
  { value: "OVA", label: "OVA" },
  { value: "ONA", label: "ONA" },
  { value: "MUSIC", label: "Music" },
];

export const SORT_OPTIONS: BrowseFilterOption[] = [
  { value: "popularity", label: "Popularity" },
  { value: "score", label: "Average Score" },
  { value: "release_date", label: "Release Date" },
  { value: "favourites", label: "Favourites" },
  { value: "trending", label: "Trending" },
];

export const SEASON_OPTIONS: BrowseFilterOption[] = [
  { value: "WINTER", label: "Winter" },
  { value: "SPRING", label: "Spring" },
  { value: "SUMMER", label: "Summer" },
  { value: "FALL", label: "Fall" },
];

export const STATUS_OPTIONS: BrowseFilterOption[] = [
  { value: "RELEASING", label: "Ongoing" },
  { value: "FINISHED", label: "Finished" },
  { value: "NOT_YET_RELEASED", label: "Upcoming" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "HIATUS", label: "Hiatus" },
];

export const COUNTRY_OPTIONS: BrowseFilterOption[] = [
  { value: "JP", label: "Japan" },
  { value: "KR", label: "South Korea" },
  { value: "CN", label: "China" },
  { value: "TW", label: "Taiwan" },
];

export const SOURCE_OPTIONS: BrowseFilterOption[] = [
  { value: "ORIGINAL", label: "Original" },
  { value: "ANIME", label: "Anime" },
  { value: "MANGA", label: "Manga" },
  { value: "NOVEL", label: "Novel" },
  { value: "LIGHT_NOVEL", label: "Light Novel" },
  { value: "WEB_NOVEL", label: "Web Novel" },
  { value: "COMIC", label: "Comic" },
  { value: "DOUJINSHI", label: "Doujinshi" },
  { value: "LIVE_ACTION", label: "Live Action" },
  { value: "VIDEO_GAME", label: "Video Game" },
  { value: "GAME", label: "Game" },
  { value: "MULTIMEDIA_PROJECT", label: "Multimedia Project" },
  { value: "PICTURE_BOOK", label: "Picture Book" },
  { value: "OTHER", label: "Other" },
];

export const FALLBACK_GENRE_OPTIONS: BrowseFilterOption[] = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Ecchi",
  "Fantasy",
  "Horror",
  "Mahou Shoujo",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
].map((genre) => ({ value: genre, label: genre }));

export const FALLBACK_TAG_OPTIONS: BrowseFilterOption[] = [
  "4-koma",
  "Achronological Order",
  "Afterlife",
  "Age Gap",
  "Airsoft",
  "Aliens",
  "Alternate Universe",
  "American Football",
  "Amnesia",
  "Anti-Hero",
  "Archery",
  "Assassins",
  "Aviation",
  "Band",
  "Baseball",
  "Basketball",
  "Battle Royale",
  "Body Horror",
  "Boxing",
  "CGI",
  "Coming of Age",
  "Conspiracy",
  "Crime",
  "Cyberpunk",
  "Dancing",
  "Demons",
  "Detective",
  "Dragons",
  "Dungeon",
  "Dystopian",
  "Educational",
  "Ensemble Cast",
  "Espionage",
  "Family Life",
  "Food",
  "Ghost",
  "Gods",
  "Gore",
  "Guns",
  "Historical",
  "Idol",
  "Isekai",
  "Iyashikei",
  "Love Triangle",
  "Magic",
  "Martial Arts",
  "Military",
  "Mythology",
  "Ninja",
  "Otaku Culture",
  "Parody",
  "Pirates",
  "Post-Apocalyptic",
  "Reincarnation",
  "Revenge",
  "Robots",
  "Samurai",
  "School",
  "Shapeshifting",
  "Space",
  "Super Power",
  "Survival",
  "Time Manipulation",
  "Urban Fantasy",
  "Vampire",
  "Virtual World",
  "War",
  "Work",
].map((tag) => ({ value: tag, label: tag }));

const FORMAT_VALUES = new Set(FORMAT_OPTIONS.map((option) => option.value));
const SORT_VALUES = new Set(SORT_OPTIONS.map((option) => option.value));
const SEASON_VALUES = new Set(SEASON_OPTIONS.map((option) => option.value));
const STATUS_VALUES = new Set(STATUS_OPTIONS.map((option) => option.value));
const COUNTRY_VALUES = new Set(COUNTRY_OPTIONS.map((option) => option.value));
const SOURCE_VALUES = new Set(SOURCE_OPTIONS.map((option) => option.value));
const LIST_VALUES = new Set(LIST_OPTIONS.map((option) => option.value));

function readParam(value: string | string[] | undefined): string {
  const rawValue = Array.isArray(value) ? value[0] : value;

  return rawValue?.trim() || "";
}

function readAllowedParam(
  value: string | string[] | undefined,
  allowedValues: Set<string>,
): string {
  const rawValue = readParam(value);

  return allowedValues.has(rawValue) ? rawValue : "";
}

function readYearParam(value: string | string[] | undefined): string {
  const rawValue = readParam(value);

  return /^\d{4}$/.test(rawValue) ? rawValue : "";
}

export function getYearOptions(): BrowseFilterOption[] {
  const currentYear = new Date().getFullYear();
  const firstYear = 1940;
  const options: BrowseFilterOption[] = [];

  for (let year = currentYear; year >= firstYear; year -= 1) {
    options.push({ value: String(year), label: String(year) });
  }

  return options;
}

export function getDefaultBrowseSort(section: BrowseSectionKey): string {
  switch (section) {
    case "trending":
      return "trending";
    case "finished":
      return "release_date";
    case "movies":
      return "score";
    case "airing":
    case "upcoming":
    default:
      return "popularity";
  }
}

export function parseBrowseParams(
  params: BrowseSearchParams,
): ParsedBrowseParams {
  return {
    page: parsePageParam(params.page),
    filters: {
      q: readParam(params.q),
      genre: readParam(params.genre),
      format: readAllowedParam(params.format, FORMAT_VALUES),
      year: readYearParam(params.year),
      sort: readAllowedParam(params.sort, SORT_VALUES),
      season: readAllowedParam(params.season, SEASON_VALUES),
      status: readAllowedParam(params.status, STATUS_VALUES),
      tag: readParam(params.tag),
      country: readAllowedParam(params.country, COUNTRY_VALUES),
      source: readAllowedParam(params.source, SOURCE_VALUES),
      list: readAllowedParam(params.list, LIST_VALUES),
    },
  };
}

export function buildBrowseHref(
  basePath: string,
  filters: BrowseFilters,
  page = 1,
): string {
  const query = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      query.set(key, value);
    }
  });

  if (page > 1) {
    query.set("page", String(page));
  }

  const queryString = query.toString();

  return queryString ? `${basePath}?${queryString}` : basePath;
}
