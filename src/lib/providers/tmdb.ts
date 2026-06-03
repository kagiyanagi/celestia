import { fetchJson } from "@/lib/http/client";
import type { AnimeStreamingEpisode, ProviderHealth } from "@/types/anime";

const TMDB_ENDPOINT = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const TMDB_API_KEY = process.env.TMDB_API_KEY || "";
// v4 read access tokens are JWTs; v3 keys are short hex strings.
const IS_BEARER_TOKEN = TMDB_API_KEY.startsWith("ey");
const MAX_SEASON_REQUESTS = 40;

type TmdbShowResponse = {
  number_of_episodes?: number;
  seasons?: Array<{
    season_number?: number;
    episode_count?: number;
  }>;
};

type TmdbSeasonResponse = {
  episodes?: Array<{
    episode_number?: number;
    name?: string;
    overview?: string;
    still_path?: string | null;
    runtime?: number | null;
    air_date?: string | null;
    vote_average?: number | null;
  }>;
};

export function isTmdbConfigured(): boolean {
  return Boolean(TMDB_API_KEY);
}

export function getTmdbProviderHealth(): ProviderHealth {
  return {
    name: "TMDB",
    role: "metadata",
    status: isTmdbConfigured() ? "ready" : "disabled",
    notes: isTmdbConfigured()
      ? "Episode stills and titles for series with sparse TVDB coverage."
      : "TMDB enrichment is disabled. Set TMDB_API_KEY to enable episode stills.",
  };
}

async function getTmdbJson<T>(path: string): Promise<T | null> {
  if (!isTmdbConfigured()) {
    return null;
  }

  const separator = path.includes("?") ? "&" : "?";
  const url = IS_BEARER_TOKEN
    ? `${TMDB_ENDPOINT}${path}`
    : `${TMDB_ENDPOINT}${path}${separator}api_key=${TMDB_API_KEY}`;

  try {
    return await fetchJson<T>(
      url,
      {
        headers: IS_BEARER_TOKEN
          ? { Authorization: `Bearer ${TMDB_API_KEY}` }
          : {},
        next: { revalidate: 86400 },
      },
      {
        provider: "TMDB",
        timeoutMs: 7_000,
        retries: 1,
        retryDelayMs: 400,
        cacheKey: `tmdb:${path}`,
        staleTtlMs: 86400 * 1000 * 7,
      },
    );
  } catch (error) {
    console.warn(`TMDB request failed for ${path}`, error);
    return null;
  }
}

function getRegularSeasons(show: TmdbShowResponse): number[] {
  return (show.seasons || [])
    .filter(
      (season) =>
        typeof season.season_number === "number" &&
        season.season_number > 0 &&
        (season.episode_count || 0) > 0,
    )
    .map((season) => season.season_number as number)
    .sort((a, b) => a - b);
}

function countRegularEpisodes(show: TmdbShowResponse): number {
  return (show.seasons || [])
    .filter((season) => (season.season_number || 0) > 0)
    .reduce((total, season) => total + (season.episode_count || 0), 0);
}

/**
 * Fetches absolute-numbered episode stills for a TMDB TV show.
 *
 * Only safe when the catalog entry spans the WHOLE show (e.g. One Piece),
 * because TMDB IDs map to entire shows while AniList entries are often a
 * single season. The expectedEpisodes sanity check guards against that
 * misalignment: when the totals disagree beyond tolerance we return nothing
 * rather than mislabeled images.
 */
export async function getTmdbEpisodeStills(input: {
  tmdbId: number;
  expectedEpisodes: number | null;
}): Promise<AnimeStreamingEpisode[]> {
  const show = await getTmdbJson<TmdbShowResponse>(`/tv/${input.tmdbId}`);

  if (!show) {
    return [];
  }

  const totalRegular = countRegularEpisodes(show);
  const seasons = getRegularSeasons(show);

  if (!totalRegular || seasons.length === 0) {
    return [];
  }

  if (input.expectedEpisodes) {
    const tolerance = Math.max(5, Math.round(input.expectedEpisodes * 0.05));
    if (Math.abs(totalRegular - input.expectedEpisodes) > tolerance) {
      return [];
    }
  }

  if (seasons.length > MAX_SEASON_REQUESTS) {
    return [];
  }

  const seasonPayloads = await Promise.all(
    seasons.map((seasonNumber) =>
      getTmdbJson<TmdbSeasonResponse>(`/tv/${input.tmdbId}/season/${seasonNumber}`),
    ),
  );

  let absoluteNumber = 0;

  return seasonPayloads.flatMap((season) =>
    (season?.episodes || [])
      .slice()
      .sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0))
      .map((episode) => {
        absoluteNumber += 1;

        return {
          number: absoluteNumber,
          title: episode.name || null,
          thumbnail: episode.still_path
            ? `${TMDB_IMAGE_BASE}${episode.still_path}`
            : null,
          description: episode.overview || null,
          url: null,
          site: "TMDB",
          airDate: episode.air_date || null,
          rating:
            typeof episode.vote_average === "number" &&
            episode.vote_average > 0
              ? Math.round(episode.vote_average * 10) / 10
              : null,
        };
      }),
  );
}
