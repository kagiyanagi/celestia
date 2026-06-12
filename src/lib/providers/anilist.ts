import { cache } from "react";

import { withSoftTimeout } from "@/lib/async";
import { getDisplayTitle } from "@/lib/format";
import { getCurrentAnimeSeason } from "@/lib/anime-season";
import {
  FALLBACK_GENRE_OPTIONS,
  FALLBACK_TAG_OPTIONS,
  splitListFilter,
} from "@/lib/browse-filters";
import { fetchJson } from "@/lib/http/client";
import {
  enrichAiringScheduleWithAnimeSchedule,
  enrichSummariesWithDubCounts,
  getDubInfo,
} from "@/lib/providers/anime-schedule";
import { getAnimeMappings } from "@/lib/providers/anizip";
import { resolveBannerFallback } from "@/lib/providers/banner";
import { getEpisodeMetadata } from "@/lib/providers/episode-metadata";
import { getJikanEpisodeFlags, getMalStats } from "@/lib/providers/jikan";
import {
  transformAnimeDetails,
  transformAnimeSummary,
  transformCharacterCredits,
  type AniListDetailsMedia,
  type AniListMedia,
} from "@/lib/providers/transformers/anilist";
import type {
  AniListProfile,
  LibraryEntry,
  SyncedActivity,
} from "@/types/account";
import type {
  AiringItem,
  AnimeDetails,
  AnimeSeason,
  AnimeStreamingEpisode,
  AnimeSummary,
  CharacterCredit,
  BrowseCollection,
  BrowseFilterOptions,
  BrowseFilters,
  BrowseSectionKey,
  HomeCollections,
} from "@/types/anime";

const ANILIST_ENDPOINT =
  process.env.ANILIST_GRAPHQL_ENDPOINT || "https://graphql.anilist.co";

export const MEDIA_CARD_FIELDS = `
  id
  idMal
  title {
    romaji
    english
    native
    userPreferred
  }
  coverImage {
    extraLarge
    large
    color
  }
  bannerImage
  format
  status
  source
  episodes
  duration
  season
  seasonYear
  startDate {
    year
    month
    day
  }
  averageScore
  meanScore
  popularity
  trending
  favourites
  genres
  description(asHtml: false)
  nextAiringEpisode {
    episode
    airingAt
    timeUntilAiring
  }
  studios(isMain: true) {
    nodes {
      id
      name
    }
  }
`;

// AniList treats `isAdult: null` as "match titles whose isAdult is null" — which
// is none — rather than "no filter". So to include adult content we must OMIT
// the argument entirely; the SFW filter is only present when hiding adult.
const sfwFilter = (includeAdult: boolean) =>
  includeAdult ? "" : "isAdult: false,";

const homeQuery = (includeAdult: boolean) => `
  query HomeCollections(
    $season: MediaSeason,
    $seasonYear: Int,
    $nextSeason: MediaSeason,
    $nextSeasonYear: Int
  ) {
    topAiring: Page(page: 1, perPage: 10) {
      media(
        ${sfwFilter(includeAdult)}
        type: ANIME,
        status: RELEASING,
        sort: [POPULARITY_DESC, TRENDING_DESC]
      ) {
        ${MEDIA_CARD_FIELDS}
      }
    }
    trending: Page(page: 1, perPage: 12) {
      media(${sfwFilter(includeAdult)} type: ANIME, sort: TRENDING_DESC) {
        ${MEDIA_CARD_FIELDS}
      }
    }
    season: Page(page: 1, perPage: 12) {
      media(${sfwFilter(includeAdult)} type: ANIME, season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC) {
        ${MEDIA_CARD_FIELDS}
      }
    }
    upcoming: Page(page: 1, perPage: 6) {
      media(
        ${sfwFilter(includeAdult)}
        type: ANIME,
        season: $nextSeason,
        seasonYear: $nextSeasonYear,
        sort: POPULARITY_DESC
      ) {
        ${MEDIA_CARD_FIELDS}
      }
    }
    finished: Page(page: 1, perPage: 5) {
      media(${sfwFilter(includeAdult)} type: ANIME, status: FINISHED, sort: END_DATE_DESC) {
        ${MEDIA_CARD_FIELDS}
      }
    }
    movies: Page(page: 1, perPage: 5) {
      media(${sfwFilter(includeAdult)} type: ANIME, format: MOVIE, sort: [SCORE_DESC, POPULARITY_DESC]) {
        ${MEDIA_CARD_FIELDS}
      }
    }
    airing: Page(page: 1, perPage: 8) {
      airingSchedules(notYetAired: true, sort: TIME) {
        episode
        airingAt
        media {
          type
          ${MEDIA_CARD_FIELDS}
        }
      }
    }
  }`;

const AIRING_SCHEDULE_QUERY = `
  query AiringSchedule(
    $page: Int,
    $perPage: Int,
    $startAt: Int,
    $endAt: Int
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        hasNextPage
      }
      airingSchedules(
        airingAt_greater: $startAt,
        airingAt_lesser: $endAt,
        sort: TIME
      ) {
        id
        episode
        airingAt
        media {
          type
          ${MEDIA_CARD_FIELDS}
        }
      }
    }
  }
`;

const browseQuery = (includeAdult: boolean) => `
  query BrowseCollection(
    $page: Int,
    $perPage: Int,
    $search: String,
    $genre_in: [String],
    $genre_not_in: [String],
    $tag_in: [String],
    $tag_not_in: [String],
    $season: MediaSeason,
    $seasonYear: Int,
    $startDate_greater: FuzzyDateInt,
    $startDate_lesser: FuzzyDateInt,
    $status: MediaStatus,
    $format: MediaFormat,
    $countryOfOrigin: CountryCode,
    $source: MediaSource,
    $averageScore_greater: Int,
    $episodes_greater: Int,
    $episodes_lesser: Int,
    $sort: [MediaSort]
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
        perPage
      }
      media(
        ${sfwFilter(includeAdult)}
        type: ANIME,
        search: $search,
        genre_in: $genre_in,
        genre_not_in: $genre_not_in,
        tag_in: $tag_in,
        tag_not_in: $tag_not_in,
        season: $season,
        seasonYear: $seasonYear,
        startDate_greater: $startDate_greater,
        startDate_lesser: $startDate_lesser,
        status: $status,
        format: $format,
        countryOfOrigin: $countryOfOrigin,
        source: $source,
        averageScore_greater: $averageScore_greater,
        episodes_greater: $episodes_greater,
        episodes_lesser: $episodes_lesser,
        sort: $sort
      ) {
        ${MEDIA_CARD_FIELDS}
      }
    }
  }
`;

const FILTER_OPTIONS_QUERY = `
  query BrowseFilterOptions {
    genres: GenreCollection
    tags: MediaTagCollection {
      name
      isAdult
    }
  }
`;

const searchQuery = (includeAdult: boolean) => `
  query SearchAnime($search: String!, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(${sfwFilter(includeAdult)} search: $search, type: ANIME, sort: SEARCH_MATCH) {
        ${MEDIA_CARD_FIELDS}
      }
    }
  }
`;

const DETAIL_QUERY = `
  query AnimeDetails($id: Int!) {
    Media(id: $id, type: ANIME) {
      ${MEDIA_CARD_FIELDS}
      description(asHtml: false)
      source
      countryOfOrigin
      hashtag
      synonyms
      streamingEpisodes {
        title
        thumbnail
        url
        site
      }
      startDate {
        year
        month
        day
      }
      endDate {
        year
        month
        day
      }
      trailer {
        id
        site
        thumbnail
      }
      tags {
        name
        rank
        isMediaSpoiler
        isGeneralSpoiler
      }
      rankings {
        rank
        type
        allTime
        context
      }
      externalLinks {
        id
        site
        url
        type
        language
        color
      }
      stats {
        scoreDistribution {
          score
          amount
        }
      }
      characters(sort: [ROLE, RELEVANCE], perPage: 25) {
        pageInfo {
          hasNextPage
        }
        edges {
          role
          node {
            id
            name {
              full
              native
            }
            image {
              large
            }
          }
          voiceActors {
            id
            name {
              full
            }
            image {
              large
            }
            languageV2
          }
        }
      }
      staff(sort: [RELEVANCE, ROLE], perPage: 12) {
        edges {
          role
          node {
            id
            name {
              full
            }
            image {
              large
            }
          }
        }
      }
      relations {
        edges {
          relationType
          node {
            type
            ${MEDIA_CARD_FIELDS}
          }
        }
      }
      recommendations(sort: RATING_DESC, perPage: 12) {
        nodes {
          mediaRecommendation {
            ${MEDIA_CARD_FIELDS}
          }
        }
      }
    }
  }
`;

type AniListGraphQLResponse<T> = {
  data?: T;
  errors?: Array<{
    message: string;
    status?: number;
  }>;
};

type HomeQueryResult = {
  topAiring: {
    media: AniListMedia[];
  };
  trending: {
    media: AniListMedia[];
  };
  season: {
    media: AniListMedia[];
  };
  upcoming: {
    media: AniListMedia[];
  };
  finished: {
    media: AniListMedia[];
  };
  movies: {
    media: AniListMedia[];
  };
  airing: {
    airingSchedules: Array<{
      episode: number;
      airingAt: number;
      media: AniListMedia & { type: string | null };
    }>;
  };
};

type AiringScheduleQueryResult = {
  Page: {
    pageInfo: {
      hasNextPage: boolean;
    } | null;
    airingSchedules: Array<{
      id: number;
      episode: number;
      airingAt: number;
      media: AniListMedia & { type: string | null };
    }>;
  };
};

type SearchQueryResult = {
  Page: {
    media: AniListMedia[];
  };
};

type BrowseQueryResult = {
  Page: {
    pageInfo: {
      total: number | null;
      currentPage: number | null;
      lastPage: number | null;
      hasNextPage: boolean | null;
      perPage: number | null;
    } | null;
    media: AniListMedia[];
  };
};

type FilterOptionsQueryResult = {
  genres: string[] | null;
  tags: Array<{
    name: string;
    isAdult: boolean | null;
  }> | null;
};

type DetailQueryResult = {
  Media: AniListDetailsMedia | null;
};

class AniListError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AniListError";
  }
}

function getAniListOperationName(query: string): string {
  return (
    query.match(/\b(?:query|mutation)\s+([A-Za-z0-9_]+)/)?.[1] ||
    "AnonymousOperation"
  );
}

function getAniListCacheKey(
  query: string,
  variables: Record<string, unknown>,
): string {
  return `anilist:${getAniListOperationName(query)}:${JSON.stringify(
    variables,
  )}`;
}

export async function fetchAniList<T>(
  query: string,
  variables: Record<string, unknown> = {},
  revalidate = 300,
): Promise<T> {
  const init: RequestInit & { next?: { revalidate: number } } = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate },
  };

  const payload = await fetchJson<AniListGraphQLResponse<T>>(
    ANILIST_ENDPOINT,
    init,
    {
      provider: "AniList",
      timeoutMs: 10_000,
      retries: 2,
      retryDelayMs: 500,
      cacheKey: getAniListCacheKey(query, variables),
      staleTtlMs: revalidate * 1000 * 6,
    },
  );

  if (payload.errors?.length) {
    throw new AniListError(
      payload.errors.map((error) => error.message).join("; "),
    );
  }

  if (!payload.data) {
    throw new AniListError("AniList returned an empty payload");
  }

  return payload.data;
}

function emptyHomeCollections(): HomeCollections {
  return {
    topAiring: [],
    trending: [],
    season: [],
    upcoming: [],
    finished: [],
    movies: [],
    airingSoon: [],
  };
}

function getNextAnimeSeason(date = new Date()): {
  season: AnimeSeason;
  year: number;
} {
  const current = getCurrentAnimeSeason(date);
  const order: AnimeSeason[] = ["WINTER", "SPRING", "SUMMER", "FALL"];
  const index = order.indexOf(current.season);
  const nextIndex = (index + 1) % order.length;

  return {
    season: order[nextIndex],
    year: nextIndex === 0 ? current.year + 1 : current.year,
  };
}

export async function getHomeCollections(
  includeAdult = false,
): Promise<HomeCollections> {
  const current = getCurrentAnimeSeason();
  const next = getNextAnimeSeason();

  try {
    const data = await fetchAniList<HomeQueryResult>(
      homeQuery(includeAdult),
      {
        season: current.season,
        seasonYear: current.year,
        nextSeason: next.season,
        nextSeasonYear: next.year,
      },
      900,
    );

    // Card-level dub counts are resolved off the render path: each card
    // hydrates its own dub badge client-side via /api/dub-badges (see
    // DubBadgeProvider), so the home shell paints immediately instead of
    // blocking on a per-card AnimeSchedule fan-out across five shelves.
    const topAiring = data.topAiring.media.map(transformAnimeSummary);
    const trending = data.trending.media.map(transformAnimeSummary);
    const season = data.season.media.map(transformAnimeSummary);
    const finished = data.finished.media.map(transformAnimeSummary);
    const movies = data.movies.media.map(transformAnimeSummary);

    const airingSoon = data.airing.airingSchedules
      .filter((item) => item.media.type === "ANIME")
      .map<AiringItem>((item) => ({
        episode: item.episode,
        airingAt: item.airingAt,
        timeUntilAiring: item.airingAt - Math.floor(Date.now() / 1000),
        anime: transformAnimeSummary(item.media),
      }));

    // Banners AniList is missing for the hero/airing board now resolve
    // client-side (BannerFallbackProvider, /api/banners), off the render path —
    // the home shell no longer blocks on a per-title ani.zip/TMDB walk.
    return {
      topAiring,
      trending,
      season,
      upcoming: data.upcoming.media.map(transformAnimeSummary),
      finished,
      movies,
      airingSoon,
    };
  } catch (error) {
    console.error(error);
    return emptyHomeCollections();
  }
}

export async function getAiringSchedule(
  startAt: number,
  endAt: number,
): Promise<AiringItem[]> {
  const items: AiringItem[] = [];
  const seen = new Set<number>();
  const now = Math.floor(Date.now() / 1000);
  const perPage = 50;
  const maxPages = 4;

  try {
    // Fetch the (bounded) pages concurrently rather than serially — they're
    // independent windows of the same airing query, so this turns ~4 serial
    // round trips into one. Empty/overflow pages just contribute nothing.
    const pages = await Promise.all(
      Array.from({ length: maxPages }, (_, index) =>
        fetchAniList<AiringScheduleQueryResult>(
          AIRING_SCHEDULE_QUERY,
          { page: index + 1, perPage, startAt, endAt },
          300,
        ).catch(() => null),
      ),
    );

    for (const data of pages) {
      data?.Page.airingSchedules.forEach((item) => {
        if (item.media.type !== "ANIME" || seen.has(item.id)) return;
        seen.add(item.id);
        items.push({
          episode: item.episode,
          airingAt: item.airingAt,
          timeUntilAiring: item.airingAt - now,
          anime: transformAnimeSummary(item.media),
        });
      });
    }

    // Banners AniList is missing now resolve client-side (BannerFallbackProvider,
    // /api/banners), off the render path — the board no longer blocks on a
    // per-row ani.zip/TMDB walk.
    return enrichAiringScheduleWithAnimeSchedule(
      items.sort((a, b) => a.airingAt - b.airingAt),
      startAt,
      endAt,
    );
  } catch (error) {
    console.error(error);
    return [];
  }
}

export type RecentEpisodeDrop = {
  animeId: number;
  anime: AnimeSummary;
  episode: number;
  airedAt: number;
};

// Media.airingSchedule takes no sort arg, so query the top-level
// Page.airingSchedules connection (filterable by media + airing window).
const RECENT_DROPS_QUERY = `
  query ($ids: [Int!], $airingAtGreater: Int, $airingAtLesser: Int, $page: Int) {
    Page(perPage: 50, page: $page) {
      pageInfo {
        hasNextPage
      }
      airingSchedules(
        mediaId_in: $ids
        airingAt_greater: $airingAtGreater
        airingAt_lesser: $airingAtLesser
        sort: TIME_DESC
      ) {
        episode
        airingAt
        mediaId
        media {
          id
          title {
            romaji
            english
            native
            userPreferred
          }
          coverImage {
            extraLarge
            large
            color
          }
        }
      }
    }
  }
`;

type RecentDropsQueryResult = {
  Page: {
    pageInfo: { hasNextPage: boolean | null } | null;
    airingSchedules: Array<{
      episode: number;
      airingAt: number;
      mediaId: number;
      media: AniListMedia | null;
    }> | null;
  } | null;
};

/**
 * Returns episodes that aired on or after `sinceEpoch` for the given anime
 * ids, used to build "new episode" notifications. Bounded to the airing
 * window in-query; failures degrade to empty.
 */
export async function getRecentEpisodeDrops(
  animeIds: number[],
  sinceEpoch: number,
): Promise<RecentEpisodeDrop[]> {
  if (animeIds.length === 0) {
    return [];
  }

  const now = Math.floor(Date.now() / 1000);
  const drops: RecentEpisodeDrop[] = [];
  const maxPages = 5;

  for (let page = 1; page <= maxPages; page += 1) {
    let result: RecentDropsQueryResult;
    try {
      result = await fetchAniList<RecentDropsQueryResult>(
        RECENT_DROPS_QUERY,
        {
          ids: animeIds,
          airingAtGreater: sinceEpoch,
          airingAtLesser: now,
          page,
        },
        300,
      );
    } catch {
      break;
    }

    for (const schedule of result.Page?.airingSchedules ?? []) {
      if (!schedule.media) continue;
      drops.push({
        animeId: schedule.mediaId,
        anime: transformAnimeSummary(schedule.media),
        episode: schedule.episode,
        airedAt: schedule.airingAt,
      });
    }

    if (!result.Page?.pageInfo?.hasNextPage) {
      break;
    }
  }

  return drops;
}

/**
 * Returns episodes scheduled to air within the next `withinSeconds`, used to
 * build "airing soon" reminders. `airedAt` is the (future) scheduled airing
 * time. Failures degrade to empty.
 */
export async function getUpcomingEpisodes(
  animeIds: number[],
  withinSeconds: number,
): Promise<RecentEpisodeDrop[]> {
  if (animeIds.length === 0) {
    return [];
  }

  const now = Math.floor(Date.now() / 1000);
  const drops: RecentEpisodeDrop[] = [];
  const maxPages = 5;

  for (let page = 1; page <= maxPages; page += 1) {
    let result: RecentDropsQueryResult;
    try {
      result = await fetchAniList<RecentDropsQueryResult>(
        RECENT_DROPS_QUERY,
        {
          ids: animeIds,
          airingAtGreater: now,
          airingAtLesser: now + withinSeconds,
          page,
        },
        300,
      );
    } catch {
      break;
    }

    for (const schedule of result.Page?.airingSchedules ?? []) {
      if (!schedule.media) continue;
      drops.push({
        animeId: schedule.mediaId,
        anime: transformAnimeSummary(schedule.media),
        episode: schedule.episode,
        airedAt: schedule.airingAt,
      });
    }

    if (!result.Page?.pageInfo?.hasNextPage) {
      break;
    }
  }

  return drops;
}

function resolveBrowseSort(
  sort: string,
  section: BrowseSectionKey,
  status: string,
  sortOrder: string,
): string[] | null {
  const suffix = sortOrder === "asc" ? "" : "_DESC";

  switch (sort) {
    case "popularity":
      return [`POPULARITY${suffix}`];
    case "score":
      return [`SCORE${suffix}`, "POPULARITY_DESC"];
    case "release_date":
      return section === "finished" || status === "FINISHED"
        ? [`END_DATE${suffix}`]
        : [`START_DATE${suffix}`];
    case "favourites":
      return [`FAVOURITES${suffix}`];
    case "trending":
      return [`TRENDING${suffix}`, "POPULARITY_DESC"];
    case "title":
      // No `suffix` games: A-Z is ascending, the order toggle flips it.
      return [sortOrder === "asc" ? "TITLE_ROMAJI" : "TITLE_ROMAJI_DESC"];
    case "episodes":
      return [`EPISODES${suffix}`, "POPULARITY_DESC"];
    case "updated":
      return [`UPDATED_AT${suffix}`];
    default:
      return null;
  }
}

function getBrowseFilterVariables(
  filters: BrowseFilters | undefined,
  section: BrowseSectionKey,
): Record<string, unknown> {
  if (!filters) return {};

  const variables: Record<string, unknown> = {};
  const search = filters.q.trim();

  if (search) variables.search = search;

  const genreIn = splitListFilter(filters.genre);
  const genreNotIn = splitListFilter(filters.genreExclude);
  const tagIn = splitListFilter(filters.tag);
  const tagNotIn = splitListFilter(filters.tagExclude);
  if (genreIn.length) variables.genre_in = genreIn;
  if (genreNotIn.length) variables.genre_not_in = genreNotIn;
  if (tagIn.length) variables.tag_in = tagIn;
  if (tagNotIn.length) variables.tag_not_in = tagNotIn;

  if (filters.format) variables.format = filters.format;

  // A single exact year keeps the precise season pairing AniList needs;
  // a true range maps to fuzzy start-date bounds instead (where seasonYear
  // can't express both ends).
  const yearMin = filters.yearMin ? Number(filters.yearMin) : null;
  const yearMax = filters.yearMax ? Number(filters.yearMax) : null;
  if (yearMin && yearMax && yearMin === yearMax) {
    variables.seasonYear = yearMin;
  } else {
    if (yearMin) variables.startDate_greater = yearMin * 10_000;
    if (yearMax) variables.startDate_lesser = yearMax * 10_000 + 1231;
  }

  if (filters.season) variables.season = filters.season;
  if (filters.status) variables.status = filters.status;
  if (filters.country) variables.countryOfOrigin = filters.country;
  if (filters.source) variables.source = filters.source;

  // averageScore_greater is exclusive; subtract one to keep the bound inclusive.
  if (filters.scoreMin) {
    variables.averageScore_greater = Math.max(0, Number(filters.scoreMin) - 1);
  }
  // episodes_greater/_lesser are exclusive bounds; widen by one for inclusivity.
  if (filters.episodesMin) {
    variables.episodes_greater = Number(filters.episodesMin) - 1;
  }
  if (filters.episodesMax) {
    variables.episodes_lesser = Number(filters.episodesMax) + 1;
  }

  const sort = resolveBrowseSort(
    filters.sort,
    section,
    filters.status,
    filters.sortOrder,
  );
  if (sort) variables.sort = sort;

  return variables;
}

export async function getBrowseFilterOptions(): Promise<BrowseFilterOptions> {
  try {
    const data = await fetchAniList<FilterOptionsQueryResult>(
      FILTER_OPTIONS_QUERY,
      {},
      86_400,
    );
    const genres =
      data.genres
        ?.filter((genre) => genre && genre !== "Hentai")
        .map((genre) => ({ value: genre, label: genre })) || [];
    const tags =
      data.tags
        ?.filter((tag) => tag.name && !tag.isAdult)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((tag) => ({ value: tag.name, label: tag.name })) || [];

    return {
      genres: genres.length ? genres : FALLBACK_GENRE_OPTIONS,
      tags: tags.length ? tags : FALLBACK_TAG_OPTIONS,
    };
  } catch (error) {
    console.error(error);
    return {
      genres: FALLBACK_GENRE_OPTIONS,
      tags: FALLBACK_TAG_OPTIONS,
    };
  }
}

function getBrowseSectionSettings(
  section: BrowseSectionKey,
  next: { season: AnimeSeason; year: number },
): Record<string, unknown> {
  const settings: Record<BrowseSectionKey, Record<string, unknown>> = {
    airing: {
      status: "RELEASING",
      sort: ["POPULARITY_DESC", "TRENDING_DESC"],
    },
    trending: {
      sort: ["TRENDING_DESC", "POPULARITY_DESC"],
    },
    upcoming: {
      season: next.season,
      seasonYear: next.year,
      sort: ["POPULARITY_DESC", "TRENDING_DESC"],
    },
    finished: {
      status: "FINISHED",
      sort: ["END_DATE_DESC"],
    },
    movies: {
      format: "MOVIE",
      sort: ["SCORE_DESC", "POPULARITY_DESC"],
    },
    search: {},
  };
  return settings[section];
}

export async function getBrowseCollection(
  section: BrowseSectionKey,
  page = 1,
  filters?: BrowseFilters,
  includeAdult = false,
): Promise<BrowseCollection> {
  const next = getNextAnimeSeason();
  const perPage = 30;
  const safePage = Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1);

  try {
    const data = await fetchAniList<BrowseQueryResult>(
      browseQuery(includeAdult),
      {
        page: safePage,
        perPage,
        ...getBrowseSectionSettings(section, next),
        ...getBrowseFilterVariables(filters, section),
      },
      900,
    );

    return {
      // Dub badges hydrate client-side (see DubBadgeProvider) — keep the
      // listing render path free of the per-card AnimeSchedule fan-out.
      items: data.Page.media.map(transformAnimeSummary),
      pageInfo: {
        total: data.Page.pageInfo?.total ?? null,
        currentPage: data.Page.pageInfo?.currentPage || safePage,
        lastPage: data.Page.pageInfo?.lastPage ?? null,
        hasNextPage: Boolean(data.Page.pageInfo?.hasNextPage),
        perPage: data.Page.pageInfo?.perPage || perPage,
      },
    };
  } catch (error) {
    console.error(error);
    return {
      items: [],
      pageInfo: {
        total: null,
        currentPage: safePage,
        lastPage: null,
        hasNextPage: false,
        perPage,
      },
    };
  }
}

const DUB_BADGE_QUERY = `
  query ($ids: [Int!]) {
    Page(perPage: 50) {
      media(id_in: $ids, type: ANIME) {
        ${MEDIA_CARD_FIELDS}
      }
    }
  }
`;

/**
 * Resolves dub episode counts for a set of AniList ids off the render path.
 * Backs the `/api/dub-badges` endpoint that card dub badges hydrate from, so
 * the expensive per-id AnimeSchedule lookup never blocks a listing's first
 * paint. Returns only ids with a verifiable dub; the rest stay "unknown"
 * (badge hidden), preserving the accuracy-over-fabrication rule.
 */
export async function getDubCountsByAniListIds(
  ids: number[],
): Promise<Record<number, number>> {
  const unique = Array.from(
    new Set(ids.filter((id) => Number.isFinite(id) && id > 0)),
  ).slice(0, 50);

  if (unique.length === 0) {
    return {};
  }

  try {
    const data = await fetchAniList<{ Page: { media: AniListMedia[] | null } }>(
      DUB_BADGE_QUERY,
      { ids: unique },
      900,
    );

    const enriched = await enrichSummariesWithDubCounts(
      (data.Page?.media ?? []).map(transformAnimeSummary),
    );

    const counts: Record<number, number> = {};
    for (const summary of enriched) {
      if (summary.dubCount != null) {
        counts[summary.id] = summary.dubCount;
      }
    }
    return counts;
  } catch (error) {
    console.error(error);
    return {};
  }
}

const MAL_LOOKUP_QUERY = `
  query ($idMal_in: [Int!]) {
    Page(perPage: 50) {
      media(idMal_in: $idMal_in, type: ANIME) {
        ${MEDIA_CARD_FIELDS}
      }
    }
  }
`;

/**
 * Resolves MAL ids (from an imported XML export) to AniList summaries. AniList
 * tracks MAL ids natively, so this is an exact mapping — no fuzzy title match.
 * Queried in chunks of 50 (AniList's per-page cap); unresolved ids are simply
 * absent from the result, preserving accuracy-over-fabrication.
 */
export async function getAnimeSummariesByMalIds(
  malIds: number[],
): Promise<Map<number, AnimeSummary>> {
  const unique = Array.from(
    new Set(malIds.filter((id) => Number.isFinite(id) && id > 0)),
  );
  const resolved = new Map<number, AnimeSummary>();

  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    try {
      const data = await fetchAniList<{ Page: { media: AniListMedia[] | null } }>(
        MAL_LOOKUP_QUERY,
        { idMal_in: chunk },
        900,
      );
      for (const media of data.Page?.media ?? []) {
        const summary = transformAnimeSummary(media);
        if (summary.idMal) {
          resolved.set(summary.idMal, summary);
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  return resolved;
}

const RECOMMENDATIONS_QUERY = `
  query ($ids: [Int!]) {
    Page(perPage: 50) {
      media(id_in: $ids, type: ANIME) {
        id
        recommendations(sort: RATING_DESC, perPage: 8) {
          nodes {
            rating
            mediaRecommendation {
              isAdult
              ${MEDIA_CARD_FIELDS}
            }
          }
        }
      }
    }
  }
`;

type RecommendationNode = {
  rating: number | null;
  mediaRecommendation: (AniListMedia & { isAdult?: boolean | null }) | null;
};

/**
 * Aggregates AniList's per-title recommendations across a set of seed anime
 * (the user's library) into one ranked list. A recommendation's community
 * `rating` is summed across every seed that surfaces it, so titles multiple
 * favorites point to rank highest. Seeds and anything in `excludeIds` (already
 * in the library) are dropped so the rail only suggests genuinely new shows.
 */
export async function getRecommendationsFromSeeds(
  seedIds: number[],
  options: {
    excludeIds?: number[];
    includeAdult?: boolean;
    limit?: number;
  } = {},
): Promise<AnimeSummary[]> {
  const seeds = new Set(
    seedIds.filter((id) => Number.isFinite(id) && id > 0),
  );
  if (!seeds.size) return [];

  const exclude = new Set(options.excludeIds ?? []);
  const limit = options.limit ?? 24;

  try {
    const data = await fetchAniList<{
      Page: {
        media:
          | Array<{ id: number; recommendations: { nodes: RecommendationNode[] } }>
          | null;
      };
    }>(RECOMMENDATIONS_QUERY, { ids: Array.from(seeds).slice(0, 40) }, 1800);

    const scored = new Map<number, { score: number; media: AniListMedia }>();

    for (const seed of data.Page?.media ?? []) {
      for (const node of seed.recommendations?.nodes ?? []) {
        const rec = node.mediaRecommendation;
        if (!rec) continue;
        if (!options.includeAdult && rec.isAdult) continue;
        if (seeds.has(rec.id) || exclude.has(rec.id)) continue;

        const weight = Math.max(1, node.rating ?? 1);
        const existing = scored.get(rec.id);
        if (existing) {
          existing.score += weight;
        } else {
          scored.set(rec.id, { score: weight, media: rec });
        }
      }
    }

    return Array.from(scored.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry) => transformAnimeSummary(entry.media));
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function searchAnime(
  search: string,
  page = 1,
  includeAdult = false,
): Promise<AnimeSummary[]> {
  if (!search.trim()) return [];

  try {
    const data = await fetchAniList<SearchQueryResult>(
      searchQuery(includeAdult),
      { search, page, perPage: 18 },
      120,
    );

    return data.Page.media.map(transformAnimeSummary);
  } catch (error) {
    console.error(error);
    return [];
  }
}

async function resolveMalStats(anilistId: number, idMal: number | null) {
  // AniList usually carries the MAL ID directly; ani.zip mappings cover the
  // rest. The ani.zip payload is already fetched for episode metadata, so
  // this lookup is deduped and effectively free.
  const malId = idMal || (await getAnimeMappings(anilistId))?.malId;
  return malId ? getMalStats(malId) : null;
}

async function resolveEpisodeFlags(anilistId: number, idMal: number | null) {
  const malId = idMal || (await getAnimeMappings(anilistId))?.malId;
  return malId ? getJikanEpisodeFlags(malId) : null;
}

const CHARACTERS_PAGE_QUERY = `
  query MediaCharacters($id: Int, $page: Int) {
    Media(id: $id) {
      characters(sort: [ROLE, RELEVANCE], page: $page, perPage: 25) {
        pageInfo {
          hasNextPage
        }
        edges {
          role
          node {
            id
            name {
              full
              native
            }
            image {
              large
            }
          }
          voiceActors {
            id
            name {
              full
            }
            image {
              large
            }
            languageV2
          }
        }
      }
    }
  }
`;

type CharactersPageResult = {
  Media: {
    characters: AniListDetailsMedia["characters"] | null;
  } | null;
};

// AniList serves at most 25 character edges per page; a 10-page cap (250
// characters) covers even ensemble casts without unbounded fan-out.
const MAX_CHARACTER_PAGES = 10;

/**
 * Fetches a single character page (2..N) for the lazy Cast tab. Page 1 ships
 * with the detail render; this backs `/api/anime/[id]/characters` so large
 * casts load after first paint instead of blocking the server render.
 */
export async function getCharacterCreditsPage(
  id: number,
  page: number,
): Promise<{ characters: CharacterCredit[]; hasNextPage: boolean }> {
  const safePage = Math.min(
    MAX_CHARACTER_PAGES,
    Math.max(2, Math.floor(page) || 2),
  );

  try {
    const data = await fetchAniList<CharactersPageResult>(
      CHARACTERS_PAGE_QUERY,
      { id, page: safePage },
      900,
    );
    const characters = data.Media?.characters;

    if (!characters?.edges?.length) {
      return { characters: [], hasNextPage: false };
    }

    return {
      characters: transformCharacterCredits({
        characters,
      } as AniListDetailsMedia),
      hasNextPage:
        safePage < MAX_CHARACTER_PAGES &&
        Boolean(characters.pageInfo?.hasNextPage),
    };
  } catch (error) {
    console.warn(`Character page ${safePage} failed for AniList ${id}`, error);
    return { characters: [], hasNextPage: false };
  }
}

/**
 * React cache() dedupes the generateMetadata + page call pair within one
 * request. Enrichments are soft-capped: a slow provider returns its fallback
 * for this render while the fetch finishes in the background and warms the
 * cache for the next one — bounded latency, progressively complete data.
 */
export const getAnimeDetails = cache(async function getAnimeDetails(
  id: number,
): Promise<AnimeDetails | null> {
  try {
    const data = await fetchAniList<DetailQueryResult>(
      DETAIL_QUERY,
      { id },
      900,
    );

    if (!data.Media) return null;

    const anime = transformAnimeDetails(data.Media);
    const needsBanner = !anime.bannerImage;
    // Enrichment providers are optional and independent — run them
    // concurrently and tolerate individual failures.
    const [episodeMetadata, malStats, dubInfo, episodeFlags, bannerFallback] =
      await Promise.all([
        withSoftTimeout(
          getEpisodeMetadata({
            anilistId: id,
            anilistEpisodes: anime.streamingEpisodes || [],
            expectedEpisodes: anime.episodes ?? anime.airingCount ?? null,
          }),
          5_000,
          { episodes: anime.streamingEpisodes || [], sources: [] },
        ),
        withSoftTimeout(resolveMalStats(id, anime.idMal ?? null), 4_000, null),
        withSoftTimeout(
          getDubInfo(id, {
            expectedEpisodes: anime.episodes ?? anime.airingCount ?? null,
            idMal: anime.idMal ?? null,
            status: anime.status ?? null,
          }),
          4_000,
          null,
        ),
        withSoftTimeout(
          resolveEpisodeFlags(id, anime.idMal ?? null),
          4_000,
          null,
        ),
        needsBanner
          ? withSoftTimeout(resolveBannerFallback(id), 4_000, null)
          : Promise.resolve(null),
      ]);
    if (needsBanner && bannerFallback) {
      anime.bannerImage = bannerFallback;
    }
    anime.streamingEpisodes = episodeMetadata.episodes;
    anime.metadataSources = episodeMetadata.sources;
    anime.malStats = malStats;
    anime.dubInfo = dubInfo;
    anime.dubCount = dubInfo?.dubbedEpisodes ?? null;
    anime.episodeFlags = episodeFlags;

    // Only character page 1 (25 credits) ships with the initial render; the
    // Cast tab lazy-loads the remainder from /api/anime/[id]/characters. This
    // keeps a large ensemble cast (e.g. One Piece, ~9 pages) off the render
    // path, where it previously cost several seconds of serial AniList calls.
    return anime;
  } catch (error) {
    console.error(error);
    return null;
  }
});

/**
 * The merged episode list for one anime (AniList streaming episodes + AniZip and
 * Kitsu stills) WITHOUT the heavier detail enrichments — no Jikan ratings, no
 * AnimeSchedule dub lookup (one-id-per-request), no episode flags, no banner
 * fallback. Powers the episodes API route behind Continue-Watching thumbnail
 * enrichment, which fires per anime on home mount; routing that through the full
 * getAnimeDetails pulled in all of the above per call for data it never used.
 */
export const getEpisodeList = cache(async function getEpisodeList(
  id: number,
): Promise<AnimeStreamingEpisode[]> {
  try {
    const data = await fetchAniList<DetailQueryResult>(DETAIL_QUERY, { id }, 900);

    if (!data.Media) return [];

    const anime = transformAnimeDetails(data.Media);
    const episodeMetadata = await withSoftTimeout(
      getEpisodeMetadata({
        anilistId: id,
        anilistEpisodes: anime.streamingEpisodes || [],
        expectedEpisodes: anime.episodes ?? anime.airingCount ?? null,
      }),
      5_000,
      { episodes: anime.streamingEpisodes || [], sources: [] },
    );

    return episodeMetadata.episodes;
  } catch (error) {
    console.warn(`Episode list lookup failed for AniList ${id}`, error);
    return [];
  }
});

const VIEWER_PROFILE_QUERY = `
  query ViewerProfile {
    Viewer {
      id
      name
      about(asHtml: false)
      siteUrl
      avatar {
        large
      }
      bannerImage
      statistics {
        anime {
          count
          episodesWatched
          minutesWatched
          meanScore
          statuses {
            status
            count
          }
        }
      }
    }
  }
`;

const VIEWER_ACTIVITY_QUERY = `
  query ViewerActivity($userId: Int) {
    Page(page: 1, perPage: 50) {
      activities(userId: $userId, sort: ID_DESC, type: ANIME_LIST) {
        ... on ListActivity {
          id
          progress
          createdAt
          media {
            id
            title {
              romaji
              english
              native
              userPreferred
            }
            coverImage {
              large
            }
          }
        }
      }
    }
  }
`;

const VIEWER_LIBRARY_QUERY = `
  query ViewerLibrary($userId: Int) {
    MediaListCollection(userId: $userId, type: ANIME, forceSingleCompletedList: true) {
      lists {
        name
        entries {
          id
          status
          score
          progress
          repeat
          notes
          updatedAt
          startedAt {
            year
            month
            day
          }
          completedAt {
            year
            month
            day
          }
          media {
            ${MEDIA_CARD_FIELDS}
          }
        }
      }
    }
  }
`;

const SAVE_MEDIA_LIST_ENTRY_MUTATION = `
  mutation SaveMediaListEntry(
    $mediaId: Int!,
    $status: MediaListStatus,
    $score: Float,
    $progress: Int,
    $repeat: Int,
    $notes: String,
    $startedAt: FuzzyDateInput,
    $completedAt: FuzzyDateInput
  ) {
    SaveMediaListEntry(
      mediaId: $mediaId,
      status: $status,
      score: $score,
      progress: $progress,
      repeat: $repeat,
      notes: $notes,
      startedAt: $startedAt,
      completedAt: $completedAt
    ) {
      id
      status
      progress
      repeat
      notes
      score
    }
  }
`;

const DELETE_MEDIA_LIST_ENTRY_MUTATION = `
  mutation DeleteMediaListEntry($id: Int) {
    DeleteMediaListEntry(id: $id) {
      deleted
    }
  }
`;

type ViewerProfileResult = {
  Viewer: {
    id: number;
    name: string;
    about: string | null;
    siteUrl: string | null;
    avatar: {
      large: string | null;
    } | null;
    bannerImage: string | null;
    statistics: {
      anime: {
        count: number | null;
        episodesWatched: number | null;
        minutesWatched: number | null;
        statuses:
          | Array<{
              status: string | null;
              count: number | null;
            }>
          | null;
      } | null;
    } | null;
  } | null;
};

type ViewerActivityResult = {
  Page: {
    activities: Array<{
      id: number;
      progress: string | null;
      createdAt: number;
      media: {
        id: number;
        title: AniListMedia["title"] | null;
        coverImage: {
          large: string | null;
        } | null;
      } | null;
    }>;
  };
};

type ViewerLibraryResult = {
  MediaListCollection: {
    lists: Array<{
      name: string | null;
      entries: Array<{
        id: number;
        status: string | null;
        score: number | null;
        progress: number | null;
        repeat: number | null;
        notes: string | null;
        updatedAt: number | null;
        startedAt: {
          year: number | null;
          month: number | null;
          day: number | null;
        } | null;
        completedAt: {
          year: number | null;
          month: number | null;
          day: number | null;
        } | null;
        media: AniListMedia | null;
      }>;
    }> | null;
  } | null;
};

type SaveMediaListEntryResult = {
  SaveMediaListEntry: {
    id: number;
    status: string | null;
    progress: number | null;
    repeat: number | null;
    notes: string | null;
    score: number | null;
  } | null;
};

function toDateString(
  date:
    | {
        year: number | null;
        month: number | null;
        day: number | null;
      }
    | null
    | undefined,
) {
  if (!date?.year || !date?.month || !date?.day) {
    return null;
  }

  return `${date.year.toString().padStart(4, "0")}-${date.month
    .toString()
    .padStart(2, "0")}-${date.day.toString().padStart(2, "0")}`;
}

function toFuzzyDateInput(value: string | null) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function mapAniListStatus(status: string | null | undefined): LibraryEntry["status"] {
  switch (status) {
    case "CURRENT":
      return "watching";
    case "PLANNING":
      return "planning";
    case "PAUSED":
      return "on_hold";
    case "DROPPED":
      return "dropped";
    case "COMPLETED":
      return "completed";
    case "REPEATING":
      return "rewatching";
    default:
      return "planning";
  }
}

function toAniListStatus(status: LibraryEntry["status"]) {
  switch (status) {
    case "watching":
      return "CURRENT";
    case "planning":
      return "PLANNING";
    case "on_hold":
      return "PAUSED";
    case "dropped":
      return "DROPPED";
    case "completed":
      return "COMPLETED";
    case "rewatching":
      return "REPEATING";
    default:
      return "PLANNING";
  }
}

async function fetchAniListWithToken<T>(
  accessToken: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const payload = await fetchJson<AniListGraphQLResponse<T>>(
    ANILIST_ENDPOINT,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    },
    {
      provider: "AniList",
      timeoutMs: 10_000,
      retries: 2,
      retryDelayMs: 500,
      dedupe: false,
    },
  );

  if (payload.errors?.length) {
    throw new AniListError(
      payload.errors.map((error) => error.message).join("; "),
    );
  }

  if (!payload.data) {
    throw new AniListError("AniList returned an empty payload");
  }

  return payload.data;
}

async function postAniListToken<T>(
  body: Record<string, unknown>,
): Promise<T> {
  return fetchJson<T>(
    "https://anilist.co/api/v2/oauth/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
    {
      provider: "AniList OAuth",
      timeoutMs: 10_000,
      retries: 2,
      retryDelayMs: 500,
      dedupe: false,
    },
  );
}

export function getAniListAuthorizeUrl(state: string) {
  const clientId = process.env.ANILIST_CLIENT_ID;
  const redirectUri = process.env.ANILIST_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error("AniList OAuth is not configured.");
  }

  const url = new URL("https://anilist.co/api/v2/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeAniListCode(code: string) {
  const clientId = process.env.ANILIST_CLIENT_ID;
  const clientSecret = process.env.ANILIST_CLIENT_SECRET;
  const redirectUri = process.env.ANILIST_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("AniList OAuth is not configured.");
  }

  const payload = await postAniListToken<{ access_token?: string }>({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  if (!payload.access_token) {
    throw new Error("AniList did not return an access token.");
  }

  return payload.access_token;
}

export async function getAniListViewerProfile(accessToken: string) {
  const profileData = await fetchAniListWithToken<ViewerProfileResult>(
    accessToken,
    VIEWER_PROFILE_QUERY,
  );

  if (!profileData.Viewer) {
    throw new Error("AniList viewer profile could not be loaded.");
  }

  // Scope activity to this viewer. Without the userId filter, AniList's
  // `Page.activities` returns the global, site-wide feed (everyone's watches),
  // which would pollute the user's history with strangers' activity. The id
  // comes from the profile, so this must run after it.
  const activityData = await fetchAniListWithToken<ViewerActivityResult>(
    accessToken,
    VIEWER_ACTIVITY_QUERY,
    { userId: profileData.Viewer.id },
  );

  const animeStats = profileData.Viewer.statistics?.anime;
  const completedCount =
    animeStats?.statuses?.find((status) => status.status === "COMPLETED")
      ?.count || 0;
  // AniList reports real watch time; never estimate it from an assumed 24-min
  // episode length (movies, shorts and long finales would all be wrong).
  const watchedMinutes = animeStats?.minutesWatched || 0;
  const activity: SyncedActivity[] = activityData.Page.activities
    .filter((item) => item.media)
    .map((item) => {
      // ListActivity progress is "5" or a range "5 - 8"; the episode reached is
      // the last number, not the first.
      const numbers = item.progress?.match(/\d+/g);
      const progress = numbers ? Number(numbers[numbers.length - 1]) : 0;
      return {
        id: `anilist-${item.id}`,
        animeId: item.media?.id || 0,
        coverImage: item.media?.coverImage?.large || null,
        animeTitle: getDisplayTitle(item.media?.title || undefined),
        progress,
        createdAt: new Date(item.createdAt * 1000).toISOString(),
        source: "anilist",
      };
    });

  return {
    id: profileData.Viewer.id,
    name: profileData.Viewer.name,
    avatar: profileData.Viewer.avatar?.large || null,
    banner: profileData.Viewer.bannerImage || null,
    about: profileData.Viewer.about || null,
    siteUrl: profileData.Viewer.siteUrl || null,
    daysWatched: Number((watchedMinutes / (60 * 24)).toFixed(1)),
    animeCompleted: completedCount,
    animeCount: animeStats?.count || 0,
    activity,
  } satisfies AniListProfile;
}

export async function getAniListViewerLibrary(accessToken: string, userId: number) {
  const data = await fetchAniListWithToken<ViewerLibraryResult>(
    accessToken,
    VIEWER_LIBRARY_QUERY,
    { userId },
  );

  return (
    data.MediaListCollection?.lists
      ?.flatMap((list) => list.entries)
      .filter(
        (entry): entry is typeof entry & { media: AniListMedia } =>
          Boolean(entry.media),
      )
      .map((entry) => ({
        id: `anilist-entry-${entry.id}`,
        animeId: entry.media.id,
        anime: transformAnimeSummary(entry.media),
        status: mapAniListStatus(entry.status),
        score: entry.score || 0,
        progress: entry.progress || 0,
        repeat: entry.repeat || 0,
        notes: entry.notes || "",
        startedAt: toDateString(entry.startedAt),
        completedAt: toDateString(entry.completedAt),
        // AniList's real edit time drives newest-wins conflict resolution on
        // re-sync; fall back to now only for entries with no timestamp.
        updatedAt: entry.updatedAt
          ? new Date(entry.updatedAt * 1000).toISOString()
          : new Date().toISOString(),
        aniListEntryId: entry.id,
      } satisfies LibraryEntry)) || []
  );
}

export async function saveAniListLibraryEntry(
  accessToken: string,
  entry: Omit<LibraryEntry, "id" | "updatedAt">,
) {
  const data = await fetchAniListWithToken<SaveMediaListEntryResult>(
    accessToken,
    SAVE_MEDIA_LIST_ENTRY_MUTATION,
    {
      mediaId: entry.animeId,
      status: toAniListStatus(entry.status),
      score: entry.score,
      progress: entry.progress,
      repeat: entry.repeat,
      notes: entry.notes,
      startedAt: toFuzzyDateInput(entry.startedAt),
      completedAt: toFuzzyDateInput(entry.completedAt),
    },
  );

  return data.SaveMediaListEntry?.id || null;
}

export async function deleteAniListLibraryEntry(
  accessToken: string,
  entryId: number,
) {
  await fetchAniListWithToken(accessToken, DELETE_MEDIA_LIST_ENTRY_MUTATION, {
    id: entryId,
  });
}

const MISSED_SEQUELS_RELATIONS_QUERY = `
  query ($ids: [Int!]) {
    Page(page: 1, perPage: 50) {
      media(id_in: $ids, type: ANIME) {
        id
        relations {
          edges {
            relationType
            node {
              type
              isAdult
              ${MEDIA_CARD_FIELDS}
            }
          }
        }
      }
    }
  }
`;

type RelationsQueryResult = {
  Page: {
    media: Array<{
      id: number;
      relations: {
        edges: Array<{
          relationType: string;
          node: AniListMedia & { type: string; isAdult: boolean };
        } | null>;
      } | null;
    }> | null;
  } | null;
};

export async function getMissedSequels(
  libraryEntries: LibraryEntry[],
  includeAdult = false,
  maxCompleted = 80,
): Promise<AnimeSummary[]> {
  const completed = libraryEntries.filter((entry) => entry.status === "completed");

  const sortedCompleted = [...completed].sort((a, b) => {
    const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return timeB - timeA;
  });

  const targetCompleted =
    maxCompleted === Infinity ? sortedCompleted : sortedCompleted.slice(0, maxCompleted);
  if (targetCompleted.length === 0) {
    return [];
  }

  const ids = targetCompleted.map((entry) => entry.animeId);
  const chunks: number[][] = [];
  const chunkSize = 50;
  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize));
  }

  const libraryMap = new Map<number, LibraryEntry>();
  libraryEntries.forEach((entry) => libraryMap.set(entry.animeId, entry));

  const parentTimes = new Map<number, number>();
  targetCompleted.forEach((entry) => {
    const t = entry.updatedAt ? new Date(entry.updatedAt).getTime() : 0;
    parentTimes.set(entry.animeId, t);
  });

  const results = await Promise.all(
    chunks.map((chunk) =>
      fetchAniList<RelationsQueryResult>(
        MISSED_SEQUELS_RELATIONS_QUERY,
        { ids: chunk },
        900,
      ).catch((err) => {
        console.warn("Failed to fetch relations chunk in getMissedSequels", err);
        return null;
      })
    )
  );

  const candidatesMap = new Map<number, { maxParentTime: number; media: AniListMedia }>();

  for (const data of results) {
    if (!data?.Page?.media) continue;

    for (const mediaItem of data.Page.media) {
      const parentId = mediaItem.id;
      const parentTime = parentTimes.get(parentId) || 0;

      const edges = mediaItem.relations?.edges ?? [];
      for (const edge of edges) {
        if (!edge) continue;

        const relationType = edge.relationType;
        const node = edge.node;

        if (
          relationType !== "SEQUEL" &&
          relationType !== "SIDE_STORY" &&
          relationType !== "SPIN_OFF"
        ) {
          continue;
        }

        if (node.type !== "ANIME") {
          continue;
        }

        const localEntry = libraryMap.get(node.id);
        if (localEntry) {
          continue;
        }

        const status = node.status;
        if (status !== "FINISHED" && status !== "RELEASING") {
          continue;
        }

        if (!includeAdult && node.isAdult) {
          continue;
        }

        const existing = candidatesMap.get(node.id);
        if (!existing || parentTime > existing.maxParentTime) {
          candidatesMap.set(node.id, {
            maxParentTime: parentTime,
            media: node,
          });
        }
      }
    }
  }

  return Array.from(candidatesMap.values())
    .sort((a, b) => b.maxParentTime - a.maxParentTime)
    .map((c) => transformAnimeSummary(c.media));
}

