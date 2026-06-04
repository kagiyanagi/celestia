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
