import { getCurrentAnimeSeason } from "@/lib/anime-season";
import { cleanDescription } from "@/lib/format";
import type {
  AiringItem,
  BrowseSectionKey,
  BrowseCollection,
  AnimeDetails,
  AnimeSeason,
  AnimeSummary,
  CharacterCredit,
  ExternalLink,
  HomeCollections,
  RelationItem,
  Studio,
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
    $season: MediaSeason,
    $seasonYear: Int,
    $status: MediaStatus,
    $format: MediaFormat,
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
        season: $season,
        seasonYear: $seasonYear,
        status: $status,
        format: $format,
        sort: $sort,
        isAdult: false
      ) {
        ${MEDIA_CARD_FIELDS}
      }
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
      characters(sort: [ROLE, RELEVANCE], perPage: 8) {
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
          voiceActors(language: JAPANESE, sort: RELEVANCE) {
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
      recommendations(sort: RATING_DESC, perPage: 6) {
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

type AniListMedia = {
  id: number;
  idMal: number | null;
  title: {
    romaji: string | null;
    english: string | null;
    native: string | null;
    userPreferred: string | null;
  };
  coverImage: {
    extraLarge: string | null;
    large: string | null;
    color: string | null;
  } | null;
  bannerImage: string | null;
  format: string | null;
  status: string | null;
  source: string | null;
  description: string | null;
  episodes: number | null;
  duration: number | null;
  season: AnimeSeason | null;
  seasonYear: number | null;
  averageScore: number | null;
  meanScore: number | null;
  popularity: number | null;
  trending: number | null;
  favourites: number | null;
  genres: string[] | null;
  nextAiringEpisode: {
    episode: number;
    airingAt: number;
    timeUntilAiring: number;
  } | null;
  studios: {
    nodes: Studio[] | null;
  } | null;
};

type AniListDetailsMedia = AniListMedia & {
  description: string | null;
  source: string | null;
  countryOfOrigin: string | null;
  hashtag: string | null;
  trailer: {
    id: string | null;
    site: string | null;
    thumbnail: string | null;
  } | null;
  tags: Array<{
    name: string;
    rank: number;
    isMediaSpoiler: boolean;
    isGeneralSpoiler: boolean;
  }> | null;
  rankings: Array<{
    rank: number;
    type: string;
    allTime: boolean;
    context: string;
  }> | null;
  externalLinks: ExternalLink[] | null;
  characters: {
    edges: Array<{
      role: string | null;
      node: {
        id: number;
        name: {
          full: string | null;
          native: string | null;
        } | null;
        image: {
          large: string | null;
        } | null;
      } | null;
      voiceActors: Array<{
        id: number;
        name: {
          full: string | null;
        } | null;
        image: {
          large: string | null;
        } | null;
      }> | null;
    }> | null;
  } | null;
  relations: {
    edges: Array<{
      relationType: string;
      node: (AniListMedia & { type: string | null }) | null;
    }> | null;
  } | null;
  recommendations: {
    nodes: Array<{
      mediaRecommendation: AniListMedia | null;
    }> | null;
  } | null;
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

function toAnimeSummary(media: AniListMedia): AnimeSummary {
  const airingCount = media.nextAiringEpisode
    ? media.nextAiringEpisode.episode - 1
    : media.status === "FINISHED"
      ? media.episodes
      : media.episodes || 0;

  // Best effort dub count: finished anime are usually fully dubbed.
  // Releasing anime usually have a 2-week delay for dubs.
  const dubCount =
    media.status === "FINISHED"
      ? media.episodes
      : airingCount
        ? Math.max(0, airingCount - 2)
        : 0;

  return {
    id: media.id,
    idMal: media.idMal,
    title: media.title,
    coverImage: media.coverImage?.extraLarge || media.coverImage?.large || null,
    bannerImage: media.bannerImage,
    color: media.coverImage?.color || null,
    format: media.format,
    status: media.status,
    source: media.source,
    episodes: media.episodes,
    duration: media.duration,
    season: media.season,
    seasonYear: media.seasonYear,
    averageScore: media.averageScore,
    meanScore: media.meanScore,
    popularity: media.popularity,
    trending: media.trending,
    favourites: media.favourites,
    genres: media.genres || [],
    studios: media.studios?.nodes || [],
    nextAiringEpisode: media.nextAiringEpisode,
    description: media.description,
    airingCount,
    dubCount,
  };
}

function toCharacterCredits(media: AniListDetailsMedia): CharacterCredit[] {
  return (
    media.characters?.edges
      ?.filter((edge) => edge.node?.name?.full)
      .map((edge) => {
        const actor =
          edge.voiceActors?.find((voiceActor) => voiceActor.name?.full) || null;

        return {
          id: edge.node?.id || 0,
          name: edge.node?.name?.full || "Unknown character",
          nativeName: edge.node?.name?.native || null,
          image: edge.node?.image?.large || null,
          role: edge.role,
          voiceActor: actor
            ? {
                id: actor.id,
                name: actor.name?.full || "Unknown voice actor",
                image: actor.image?.large || null,
              }
            : null,
        };
      }) || []
  );
}

function toRelations(media: AniListDetailsMedia): RelationItem[] {
  return (
    media.relations?.edges
      ?.filter((edge) => edge.node?.type === "ANIME")
      .map((edge) => ({
        relationType: edge.relationType,
        anime: toAnimeSummary(edge.node as AniListMedia),
      })) || []
  );
}

function toAnimeDetails(media: AniListDetailsMedia): AnimeDetails {
  return {
    ...toAnimeSummary(media),
    description: cleanDescription(media.description),
    source: media.source,
    countryOfOrigin: media.countryOfOrigin,
    hashtag: media.hashtag,
    trailer: media.trailer,
    tags:
      media.tags
        ?.filter((tag) => !tag.isGeneralSpoiler && !tag.isMediaSpoiler)
        .sort((a, b) => b.rank - a.rank)
        .slice(0, 12)
        .map((tag) => tag.name) || [],
    rankings:
      media.rankings
        ?.slice(0, 4)
        .map((ranking) => `#${ranking.rank} ${ranking.context}`) || [],
    characters: toCharacterCredits(media),
    relations: toRelations(media),
    recommendations:
      media.recommendations?.nodes
        ?.map((node) => node.mediaRecommendation)
        .filter((node): node is AniListMedia => Boolean(node))
        .map(toAnimeSummary) || [],
    externalLinks: media.externalLinks || [],
  };
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
      topAiring: data.topAiring.media.map(toAnimeSummary),
      trending: data.trending.media.map(toAnimeSummary),
      season: data.season.media.map(toAnimeSummary),
      upcoming: data.upcoming.media.map(toAnimeSummary),
      finished: data.finished.media.map(toAnimeSummary),
      movies: data.movies.media.map(toAnimeSummary),
      airingSoon: data.airing.airingSchedules
        .filter((item) => item.media.type === "ANIME")
        .map<AiringItem>((item) => ({
          episode: item.episode,
          airingAt: item.airingAt,
          timeUntilAiring: item.airingAt - Math.floor(Date.now() / 1000),
          anime: toAnimeSummary(item.media),
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
        {
          page,
          perPage,
          startAt,
          endAt,
        },
        300,
      );

      data.Page.airingSchedules.forEach((item) => {
        if (item.media.type !== "ANIME" || seen.has(item.id)) {
          return;
        }

        seen.add(item.id);
        items.push({
          episode: item.episode,
          airingAt: item.airingAt,
          timeUntilAiring: item.airingAt - now,
          anime: toAnimeSummary(item.media),
        });
      });

      if (!data.Page.pageInfo?.hasNextPage) {
        break;
      }
    }

    return items.sort((a, b) => a.airingAt - b.airingAt);
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function getBrowseCollection(
  section: BrowseSectionKey,
  page = 1,
): Promise<BrowseCollection> {
  const next = getNextAnimeSeason();
  const perPage = 30;
  const requestedPage = Number.isFinite(page) ? Math.floor(page) : 1;
  const safePage = Math.max(1, requestedPage);

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
  };

  try {
    const data = await fetchAniList<BrowseQueryResult>(
      BROWSE_QUERY,
      {
        page: safePage,
        perPage,
        ...settings[section],
      },
      900,
    );

    return {
      items: data.Page.media.map(toAnimeSummary),
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
  if (!search.trim()) {
    return [];
  }

  try {
    const data = await fetchAniList<SearchQueryResult>(
      SEARCH_QUERY,
      {
        search,
        page,
        perPage: 18,
      },
      120,
    );

    return data.Page.media.map(toAnimeSummary);
  } catch (error) {
    console.error(error);
    return [];
  }
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

    return data.Media ? toAnimeDetails(data.Media) : null;
  } catch (error) {
    console.error(error);
    return null;
  }
}
