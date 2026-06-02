import { getCurrentAnimeSeason } from "@/lib/anime-season";
import {
  FALLBACK_GENRE_OPTIONS,
  FALLBACK_TAG_OPTIONS,
} from "@/lib/browse-filters";
import { getAniZipEpisodes } from "@/lib/providers/anizip";
import {
  transformAnimeDetails,
  transformAnimeSummary,
  type AniListDetailsMedia,
  type AniListMedia,
} from "@/lib/providers/transformers/anilist";
import type {
  AiringItem,
  AnimeDetails,
  AnimeSeason,
  AnimeSummary,
  BrowseCollection,
  BrowseFilterOptions,
  BrowseFilters,
  BrowseSectionKey,
  HomeCollections,
} from "@/types/anime";

const ANILIST_ENDPOINT =
  process.env.ANILIST_GRAPHQL_ENDPOINT || "https://graphql.anilist.co";

const MEDIA_CARD_FIELDS = `
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

const HOME_QUERY = `
  query HomeCollections(
    $season: MediaSeason,
    $seasonYear: Int,
    $nextSeason: MediaSeason,
    $nextSeasonYear: Int
  ) {
    topAiring: Page(page: 1, perPage: 10) {
      media(
        type: ANIME,
        status: RELEASING,
        sort: [POPULARITY_DESC, TRENDING_DESC],
        isAdult: false
      ) {
        ${MEDIA_CARD_FIELDS}
      }
    }
    trending: Page(page: 1, perPage: 12) {
      media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
        ${MEDIA_CARD_FIELDS}
      }
    }
    season: Page(page: 1, perPage: 12) {
      media(type: ANIME, season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC, isAdult: false) {
        ${MEDIA_CARD_FIELDS}
      }
    }
    upcoming: Page(page: 1, perPage: 6) {
      media(
        type: ANIME,
        season: $nextSeason,
        seasonYear: $nextSeasonYear,
        sort: POPULARITY_DESC,
        isAdult: false
      ) {
        ${MEDIA_CARD_FIELDS}
      }
    }
    finished: Page(page: 1, perPage: 5) {
      media(type: ANIME, status: FINISHED, sort: END_DATE_DESC, isAdult: false) {
        ${MEDIA_CARD_FIELDS}
      }
    }
    movies: Page(page: 1, perPage: 5) {
      media(type: ANIME, format: MOVIE, sort: [SCORE_DESC, POPULARITY_DESC], isAdult: false) {
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
  }
`;

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

const BROWSE_QUERY = `
  query BrowseCollection(
    $page: Int,
    $perPage: Int,
    $search: String,
    $genre: String,
    $tag: String,
    $season: MediaSeason,
    $seasonYear: Int,
    $status: MediaStatus,
    $format: MediaFormat,
    $countryOfOrigin: CountryCode,
    $source: MediaSource,
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
        type: ANIME,
        search: $search,
        genre: $genre,
        tag: $tag,
        season: $season,
        seasonYear: $seasonYear,
        status: $status,
        format: $format,
        countryOfOrigin: $countryOfOrigin,
        source: $source,
        sort: $sort,
        isAdult: false
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

const SEARCH_QUERY = `
  query SearchAnime($search: String!, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH, isAdult: false) {
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
      characters(sort: [ROLE, RELEVANCE], perPage: 50) {
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

async function fetchAniList<T>(
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

  const response = await fetch(ANILIST_ENDPOINT, init);

  if (!response.ok) {
    throw new AniListError(
      `AniList request failed with HTTP ${response.status}`,
    );
  }

  const payload = (await response.json()) as AniListGraphQLResponse<T>;

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

export async function getHomeCollections(): Promise<HomeCollections> {
  const current = getCurrentAnimeSeason();
  const next = getNextAnimeSeason();

  try {
    const data = await fetchAniList<HomeQueryResult>(
      HOME_QUERY,
      {
        season: current.season,
        seasonYear: current.year,
        nextSeason: next.season,
        nextSeasonYear: next.year,
      },
      900,
    );

    return {
      topAiring: data.topAiring.media.map(transformAnimeSummary),
      trending: data.trending.media.map(transformAnimeSummary),
      season: data.season.media.map(transformAnimeSummary),
      upcoming: data.upcoming.media.map(transformAnimeSummary),
      finished: data.finished.media.map(transformAnimeSummary),
      movies: data.movies.media.map(transformAnimeSummary),
      airingSoon: data.airing.airingSchedules
        .filter((item) => item.media.type === "ANIME")
        .map<AiringItem>((item) => ({
          episode: item.episode,
          airingAt: item.airingAt,
          timeUntilAiring: item.airingAt - Math.floor(Date.now() / 1000),
          anime: transformAnimeSummary(item.media),
        })),
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
    for (let page = 1; page <= maxPages; page += 1) {
      const data = await fetchAniList<AiringScheduleQueryResult>(
        AIRING_SCHEDULE_QUERY,
        { page, perPage, startAt, endAt },
        300,
      );

      data.Page.airingSchedules.forEach((item) => {
        if (item.media.type !== "ANIME" || seen.has(item.id)) return;
        seen.add(item.id);
        items.push({
          episode: item.episode,
          airingAt: item.airingAt,
          timeUntilAiring: item.airingAt - now,
          anime: transformAnimeSummary(item.media),
        });
      });

      if (!data.Page.pageInfo?.hasNextPage) break;
    }
    return items.sort((a, b) => a.airingAt - b.airingAt);
  } catch (error) {
    console.error(error);
    return [];
  }
}

function resolveBrowseSort(
  sort: string,
  section: BrowseSectionKey,
  status: string,
): string[] | null {
  switch (sort) {
    case "popularity":
      return ["POPULARITY_DESC"];
    case "score":
      return ["SCORE_DESC", "POPULARITY_DESC"];
    case "release_date":
      return section === "finished" || status === "FINISHED"
        ? ["END_DATE_DESC"]
        : ["START_DATE_DESC"];
    case "favourites":
      return ["FAVOURITES_DESC"];
    case "trending":
      return ["TRENDING_DESC", "POPULARITY_DESC"];
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
  if (filters.genre) variables.genre = filters.genre;
  if (filters.tag) variables.tag = filters.tag;
  if (filters.format) variables.format = filters.format;
  if (filters.year) variables.seasonYear = Number(filters.year);
  if (filters.season) variables.season = filters.season;
  if (filters.status) variables.status = filters.status;
  if (filters.country) variables.countryOfOrigin = filters.country;
  if (filters.source) variables.source = filters.source;

  const sort = resolveBrowseSort(filters.sort, section, filters.status);
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
): Promise<BrowseCollection> {
  const next = getNextAnimeSeason();
  const perPage = 30;
  const safePage = Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1);

  try {
    const data = await fetchAniList<BrowseQueryResult>(
      BROWSE_QUERY,
      {
        page: safePage,
        perPage,
        ...getBrowseSectionSettings(section, next),
        ...getBrowseFilterVariables(filters, section),
      },
      900,
    );

    return {
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

export async function searchAnime(
  search: string,
  page = 1,
): Promise<AnimeSummary[]> {
  if (!search.trim()) return [];

  try {
    const data = await fetchAniList<SearchQueryResult>(
      SEARCH_QUERY,
      { search, page, perPage: 18 },
      120,
    );

    return data.Page.media.map(transformAnimeSummary);
  } catch (error) {
    console.error(error);
    return [];
  }
}

async function mergeAniZipEpisodes(anime: AnimeDetails, id: number) {
  const fullEpisodes = await getAniZipEpisodes(id);
  if (fullEpisodes.length === 0 || !anime.streamingEpisodes) return;

  const aniListEpsMap = new Map<
    number,
    NonNullable<typeof anime.streamingEpisodes>[number]
  >();
  anime.streamingEpisodes.forEach((ep) => {
    if (ep.number > 0) aniListEpsMap.set(ep.number, ep);
  });

  anime.streamingEpisodes = fullEpisodes.map((ep) => {
    const aniListEp = aniListEpsMap.get(ep.number);
    return {
      ...ep,
      thumbnail: aniListEp?.thumbnail || ep.thumbnail,
      url: aniListEp?.url || ep.url,
      site: aniListEp?.site || ep.site,
    };
  });
}

export async function getAnimeDetails(
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
    await mergeAniZipEpisodes(anime, id);

    return anime;
  } catch (error) {
    console.error(error);
    return null;
  }
}
