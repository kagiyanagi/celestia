import { parsePageParam, type PaginationSearchParams } from "@/lib/pagination";
import type {
  BrowseFilterOption,
  BrowseFilters,
  BrowseSectionKey,
} from "@/types/anime";
import type { LibraryStatus } from "@/types/account";

export type BrowseSearchParams = PaginationSearchParams & {
  q?: string | string[];
  genre?: string | string[];
  genreExclude?: string | string[];
  format?: string | string[];
  yearMin?: string | string[];
  yearMax?: string | string[];
  sort?: string | string[];
  sortOrder?: string | string[];
  season?: string | string[];
  status?: string | string[];
  tag?: string | string[];
  tagExclude?: string | string[];
  country?: string | string[];
  source?: string | string[];
  scoreMin?: string | string[];
  episodesMin?: string | string[];
  episodesMax?: string | string[];
  list?: string | string[];
  dubbed?: string | string[];
};

export type ParsedBrowseParams = {
  page: number;
  filters: BrowseFilters;
};

export const EMPTY_BROWSE_FILTERS: BrowseFilters = {
  q: "",
  genre: "",
  genreExclude: "",
  format: "",
  yearMin: "",
  yearMax: "",
  sort: "",
  season: "",
  status: "",
  tag: "",
  tagExclude: "",
  country: "",
  source: "",
  scoreMin: "",
  episodesMin: "",
  episodesMax: "",
  sortOrder: "desc",
  list: "",
  dubbed: "",
};

export const FIRST_BROWSE_YEAR = 1940;

export const LIST_STATUS_OPTIONS: Array<
  BrowseFilterOption & { value: LibraryStatus }
> = [
  { value: "planning", label: "Planning" },
  { value: "watching", label: "Watching" },
  { value: "on_hold", label: "On hold" },
  { value: "dropped", label: "Dropped" },
  { value: "completed", label: "Finished" },
  { value: "rewatching", label: "Rewatching" },
];

export const LIST_OPTIONS: BrowseFilterOption[] = [
  { value: "in", label: "In your list" },
  ...LIST_STATUS_OPTIONS,
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
  { value: "title", label: "Title" },
  { value: "episodes", label: "Episode Count" },
  { value: "updated", label: "Recently Updated" },
];

export const SCORE_OPTIONS: BrowseFilterOption[] = [
  { value: "50", label: "50+" },
  { value: "60", label: "60+" },
  { value: "70", label: "70+" },
  { value: "75", label: "75+" },
  { value: "80", label: "80+" },
  { value: "85", label: "85+" },
  { value: "90", label: "90+" },
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
const SORT_ORDER_VALUES = new Set(["asc", "desc"]);
const SEASON_VALUES = new Set(SEASON_OPTIONS.map((option) => option.value));
const STATUS_VALUES = new Set(STATUS_OPTIONS.map((option) => option.value));
const COUNTRY_VALUES = new Set(COUNTRY_OPTIONS.map((option) => option.value));
const SOURCE_VALUES = new Set(SOURCE_OPTIONS.map((option) => option.value));
const LIST_VALUES = new Set(LIST_OPTIONS.map((option) => option.value));
const LIST_STATUS_VALUES = new Set<string>(
  LIST_STATUS_OPTIONS.map((option) => option.value),
);

export function isLibraryStatusFilter(value: string): value is LibraryStatus {
  return LIST_STATUS_VALUES.has(value);
}

export function isLibraryListFilter(value: string): boolean {
  return value === "in" || isLibraryStatusFilter(value);
}

export function getListFilterLabel(value: string): string {
  return LIST_OPTIONS.find((option) => option.value === value)?.label || "";
}

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

  if (!/^\d{4}$/.test(rawValue)) {
    return "";
  }

  const year = Number(rawValue);
  const currentYear = new Date().getFullYear();
  return year >= FIRST_BROWSE_YEAR && year <= currentYear + 5 ? rawValue : "";
}

/** Sanitizes a comma-separated multi-value param: trims, drops blanks/dupes. */
function readListParam(value: string | string[] | undefined): string {
  const rawValue = readParam(value);
  if (!rawValue) {
    return "";
  }

  const seen = new Set<string>();
  for (const part of rawValue.split(",")) {
    const trimmed = part.trim();
    if (trimmed) {
      seen.add(trimmed);
    }
  }

  return Array.from(seen).join(",");
}

function readBoundedIntParam(
  value: string | string[] | undefined,
  min: number,
  max: number,
): string {
  const rawValue = readParam(value);
  if (!/^\d+$/.test(rawValue)) {
    return "";
  }

  const parsed = Number(rawValue);
  return parsed >= min && parsed <= max ? String(parsed) : "";
}

/** Splits a sanitized comma list back into its values. */
export function splitListFilter(value: string): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

/** Joins selected values into the canonical comma-list form. */
export function joinListFilter(values: string[]): string {
  return Array.from(new Set(values.filter(Boolean))).join(",");
}

function readSortOrderParam(value: string | string[] | undefined): string {
  const rawValue = readParam(value);

  return SORT_ORDER_VALUES.has(rawValue) ? rawValue : "desc";
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

/**
 * Filter keys a section already pins, so the bar hides them rather than
 * offering a redundant (and confusing) control. e.g. /movies is always
 * format=MOVIE, /upcoming is always next season.
 */
export function getHiddenBrowseFilters(
  section: BrowseSectionKey,
): Set<keyof BrowseFilters> {
  switch (section) {
    case "movies":
      return new Set(["format"]);
    case "finished":
      return new Set(["status"]);
    case "airing":
      return new Set(["status"]);
    case "upcoming":
      return new Set(["status", "season", "yearMin", "yearMax"]);
    default:
      return new Set();
  }
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
  const yearMin = readYearParam(params.yearMin);
  const yearMax = readYearParam(params.yearMax);
  const episodesMin = readBoundedIntParam(params.episodesMin, 1, 10_000);
  const episodesMax = readBoundedIntParam(params.episodesMax, 1, 10_000);

  return {
    page: parsePageParam(params.page),
    filters: {
      q: readParam(params.q),
      genre: readListParam(params.genre),
      genreExclude: readListParam(params.genreExclude),
      format: readAllowedParam(params.format, FORMAT_VALUES),
      // Normalize an inverted range so min never exceeds max.
      yearMin: yearMin && yearMax && yearMin > yearMax ? yearMax : yearMin,
      yearMax: yearMin && yearMax && yearMin > yearMax ? yearMin : yearMax,
      sort: readAllowedParam(params.sort, SORT_VALUES),
      season: readAllowedParam(params.season, SEASON_VALUES),
      status: readAllowedParam(params.status, STATUS_VALUES),
      tag: readListParam(params.tag),
      tagExclude: readListParam(params.tagExclude),
      country: readAllowedParam(params.country, COUNTRY_VALUES),
      source: readAllowedParam(params.source, SOURCE_VALUES),
      scoreMin: readBoundedIntParam(params.scoreMin, 1, 100),
      episodesMin:
        episodesMin && episodesMax && Number(episodesMin) > Number(episodesMax)
          ? episodesMax
          : episodesMin,
      episodesMax:
        episodesMin && episodesMax && Number(episodesMin) > Number(episodesMax)
          ? episodesMin
          : episodesMax,
      sortOrder: readSortOrderParam(params.sortOrder),
      list: readAllowedParam(params.list, LIST_VALUES),
      dubbed: readParam(params.dubbed) === "1" ? "1" : "",
    },
  };
}

/**
 * Builds a descriptive page title from the active filters for SEO / shareable
 * links, e.g. "Action Movies (2023)" or "naruto — Search".
 */
export function buildBrowseMetaTitle(
  baseTitle: string,
  filters: BrowseFilters,
): string {
  const query = filters.q.trim();
  if (query) {
    return `${query} — Search`;
  }

  const parts: string[] = [];
  const genres = splitListFilter(filters.genre);
  if (genres.length) {
    parts.push(genres.slice(0, 2).join(" & "));
  }
  const format = FORMAT_OPTIONS.find(
    (option) => option.value === filters.format,
  )?.label;
  if (format) {
    parts.push(format);
  }
  parts.push(baseTitle);

  let label = parts.join(" ");
  if (filters.yearMin && filters.yearMax) {
    label +=
      filters.yearMin === filters.yearMax
        ? ` (${filters.yearMin})`
        : ` (${filters.yearMin}-${filters.yearMax})`;
  } else if (filters.yearMin) {
    label += ` (${filters.yearMin}+)`;
  } else if (filters.yearMax) {
    label += ` (to ${filters.yearMax})`;
  }

  return label;
}

export function buildBrowseHref(
  basePath: string,
  filters: BrowseFilters,
  page = 1,
): string {
  const query = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value && !(key === "sortOrder" && value === "desc")) {
      query.set(key, value);
    }
  });

  if (page > 1) {
    query.set("page", String(page));
  }

  const queryString = query.toString();

  return queryString ? `${basePath}?${queryString}` : basePath;
}
