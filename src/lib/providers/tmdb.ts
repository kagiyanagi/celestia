import { fetchJson } from "@/lib/http/client";
import type { ProviderHealth } from "@/types/anime";

const TMDB_ENDPOINT = "https://api.themoviedb.org/3";
const TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/w1280";
const TMDB_API_KEY = process.env.TMDB_API_KEY || "";
// v4 read access tokens are JWTs; v3 keys are short hex strings.
const IS_BEARER_TOKEN = TMDB_API_KEY.startsWith("ey");

export function isTmdbConfigured(): boolean {
  return Boolean(TMDB_API_KEY);
}

export function getTmdbProviderHealth(): ProviderHealth {
  return {
    name: "TMDB",
    role: "metadata",
    status: isTmdbConfigured() ? "ready" : "disabled",
    notes: isTmdbConfigured()
      ? "Banner backdrop fallback for titles AniList and ani.zip have no banner for."
      : "TMDB enrichment is disabled. Set TMDB_API_KEY to enable banner fallbacks.",
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

/**
 * Returns a wide backdrop image for a TMDB id — a banner fallback for titles
 * AniList and ani.zip have no banner for. ani.zip's themoviedb_id is usually a
 * TV id, so we try the type indicated by the mapping first and cross-check the
 * other only when the first id 404s (wrong type), never when it merely lacks a
 * backdrop (which would fetch a different entity sharing the numeric id).
 */
export async function getTmdbBackdrop(
  tmdbId: number,
  type?: string | null,
): Promise<string | null> {
  const isMovie = type ? /movie/i.test(type) : false;
  const paths = isMovie
    ? [`/movie/${tmdbId}`, `/tv/${tmdbId}`]
    : [`/tv/${tmdbId}`, `/movie/${tmdbId}`];

  for (const path of paths) {
    const data = await getTmdbJson<{ backdrop_path?: string | null }>(path);
    if (data?.backdrop_path) {
      return `${TMDB_BACKDROP_BASE}${data.backdrop_path}`;
    }
    if (data) {
      // Right media type, just no backdrop — don't probe the other type.
      return null;
    }
  }
  return null;
}

export type TmdbEpisodeStill = {
  number: number;
  thumbnail: string | null;
};

/**
 * Fetches episode thumbnails from TMDB for a TV show.
 * Attempts to find and query the Absolute Order episode group first to minimize
 * round-trips. Falls back to querying season details sequentially/concurrently.
 */
export async function getTmdbEpisodeStills(
  tmdbId: number,
  options: { type?: string | null } = {},
): Promise<TmdbEpisodeStill[]> {
  if (!isTmdbConfigured()) {
    return [];
  }

  const isMovie = options.type ? /movie/i.test(options.type) : false;
  if (isMovie) {
    // Movies do not have numbered episodes on TMDB
    return [];
  }

  try {
    // 1. Try to find the Absolute Order episode group (type 2)
    const groupsData = await getTmdbJson<{
      results?: Array<{
        id: string;
        type: number;
      }>;
    }>(`/tv/${tmdbId}/episode_groups`);

    const absoluteGroup = groupsData?.results?.find((g) => g.type === 2);

    if (absoluteGroup) {
      const groupDetails = await getTmdbJson<{
        groups?: Array<{
          episodes?: Array<{
            episode_number: number;
            still_path: string | null;
          }>;
        }>;
      }>(`/tv/episode_group/${absoluteGroup.id}`);

      const episodes: TmdbEpisodeStill[] = [];
      if (groupDetails?.groups) {
        for (const subGroup of groupDetails.groups) {
          if (subGroup.episodes) {
            for (const ep of subGroup.episodes) {
              if (ep.episode_number) {
                episodes.push({
                  number: ep.episode_number,
                  thumbnail: ep.still_path
                    ? `${TMDB_BACKDROP_BASE}${ep.still_path}`
                    : null,
                });
              }
            }
          }
        }
      }
      return episodes;
    }

    // 2. Fallback: Fetch TV details to get seasons list, then fetch each season
    const details = await getTmdbJson<{
      seasons?: Array<{
        season_number: number;
        episode_count: number;
      }>;
    }>(`/tv/${tmdbId}`);

    if (!details?.seasons) {
      return [];
    }

    // Filter out season 0 specials
    const seasons = details.seasons.filter((s) => s.season_number > 0);
    const seasonRequests = seasons.map((s) =>
      getTmdbJson<{
        season_number: number;
        episodes?: Array<{
          episode_number: number;
          still_path: string | null;
        }>;
      }>(`/tv/${tmdbId}/season/${s.season_number}`),
    );

    const seasonData = await Promise.all(seasonRequests);
    const episodes: TmdbEpisodeStill[] = [];
    let accumulatedOffset = 0;

    for (const data of seasonData) {
      if (!data?.episodes || data.episodes.length === 0) {
        continue;
      }

      const firstEp = data.episodes[0];
      // Detect if episode numbering resets to 1 (relative) or keeps going (absolute)
      const isRelative = data.season_number > 1 && firstEp.episode_number === 1;

      for (const ep of data.episodes) {
        const absoluteNumber = isRelative
          ? accumulatedOffset + ep.episode_number
          : ep.episode_number;

        episodes.push({
          number: absoluteNumber,
          thumbnail: ep.still_path
            ? `${TMDB_BACKDROP_BASE}${ep.still_path}`
            : null,
        });
      }

      accumulatedOffset += data.episodes.length;
    }

    return episodes;
  } catch (error) {
    console.warn(`Failed to fetch TMDB episode stills for tv show ${tmdbId}`, error);
    return [];
  }
}

