import { fetchJson } from "@/lib/http/client";
import type { MalStats, ProviderHealth } from "@/types/anime";

// Jikan is a free, keyless REST mirror of MyAnimeList data.
// Public rate limit is 60 requests/minute — long revalidation keeps us
// far below it.
const JIKAN_ENDPOINT = "https://api.jikan.moe/v4";

type JikanAnimeResponse = {
  data?: {
    mal_id?: number;
    url?: string;
    score?: number | null;
    scored_by?: number | null;
    rank?: number | null;
    popularity?: number | null;
    members?: number | null;
    favorites?: number | null;
  };
};

export function getJikanProviderHealth(): ProviderHealth {
  return {
    name: "Jikan (MyAnimeList)",
    role: "metadata",
    status: "ready",
    notes: "MyAnimeList ratings for cross-platform score comparison.",
  };
}

function toCount(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

export async function getMalStats(malId: number): Promise<MalStats | null> {
  try {
    const payload = await fetchJson<JikanAnimeResponse>(
      `${JIKAN_ENDPOINT}/anime/${malId}`,
      {
        next: { revalidate: 21_600 },
      },
      {
        provider: "Jikan",
        timeoutMs: 6_000,
        retries: 1,
        retryDelayMs: 1_000,
        cacheKey: `jikan:anime:${malId}`,
        staleTtlMs: 21_600 * 1000 * 8,
      },
    );

    if (!payload?.data?.mal_id) {
      return null;
    }

    const rawScore = payload.data.score;

    return {
      malId: payload.data.mal_id,
      score:
        typeof rawScore === "number" && rawScore > 0
          ? Math.round(rawScore * 10)
          : null,
      scoredBy: toCount(payload.data.scored_by),
      rank: toCount(payload.data.rank),
      popularity: toCount(payload.data.popularity),
      members: toCount(payload.data.members),
      favorites: toCount(payload.data.favorites),
      url: payload.data.url || `https://myanimelist.net/anime/${malId}`,
    };
  } catch (error) {
    console.warn(`Jikan stats fetch failed for MAL ${malId}`, error);
    return null;
  }
}
