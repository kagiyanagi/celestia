import { fetchJson } from "@/lib/http/client";
import type { ProviderHealth } from "@/types/anime";

// MyDubList - a daily-updated, multi-source cross-checked dataset (MAL, AniList,
// ANN, AnimeSchedule, Kitsu, aniSearch + manual review). It fills AnimeSchedule's
// gap: AnimeSchedule only has dub data for ~2020+ simulcasts, while this knows
// about older fully-dubbed catalog titles too. The "high" confidence tier
// requires >=3 independent sources to agree, keeping false positives near zero
// (accuracy over coverage). Keyed by MAL id. CC BY 4.0 - see ATTRIBUTION.
const MYDUBLIST_ENGLISH_URL =
  "https://raw.githubusercontent.com/Joelis57/MyDubList/main/dubs/confidence/high/dubbed_english.json";

export const MYDUBLIST_ATTRIBUTION =
  "Dub data from MyDubList (https://mydublist.com), CC BY 4.0.";

// Refresh the in-process snapshot roughly daily; the dataset updates once a day.
const MEMORY_TTL_MS = 12 * 60 * 60 * 1000;

type DubListResponse = {
  language?: string;
  dubbed?: number[];
  partial?: number[];
};

export type EnglishDubSets = {
  /** MAL ids with a complete English dub. */
  dubbed: Set<number>;
  /** MAL ids whose English dub is in progress / incomplete. */
  partial: Set<number>;
};

let cachedPromise: Promise<EnglishDubSets | null> | null = null;
let cachedAt = 0;

async function loadEnglishDubSets(): Promise<EnglishDubSets | null> {
  try {
    const data = await fetchJson<DubListResponse>(
      MYDUBLIST_ENGLISH_URL,
      { next: { revalidate: 86400 } },
      {
        provider: "MyDubList",
        timeoutMs: 8_000,
        retries: 1,
        retryDelayMs: 500,
        cacheKey: "mydublist:english:high",
        staleTtlMs: 86400 * 1000 * 7,
      },
    );

    if (!data) {
      return null;
    }

    return {
      dubbed: new Set(data.dubbed || []),
      partial: new Set(data.partial || []),
    };
  } catch (error) {
    console.warn("MyDubList fetch failed", error);
    return null;
  }
}

/**
 * Returns the English dub id sets, fetched once and memoized in-process (the
 * underlying ~50KB file is also cached by the HTTP client). A single shared
 * promise means a page enriching dozens of cards triggers at most one fetch.
 */
export function getEnglishDubSets(): Promise<EnglishDubSets | null> {
  if (!cachedPromise || Date.now() - cachedAt > MEMORY_TTL_MS) {
    cachedAt = Date.now();
    cachedPromise = loadEnglishDubSets();
  }
  return cachedPromise;
}

/**
 * True only when the MAL id has a COMPLETE English dub (present in `dubbed` and
 * not flagged `partial`). For a finished show this means every episode is
 * dubbed, so the dubbed-episode count equals the total episode count.
 */
export function hasCompleteEnglishDub(
  sets: EnglishDubSets | null,
  malId: number | null | undefined,
): boolean {
  if (!sets || !malId) {
    return false;
  }
  return sets.dubbed.has(malId) && !sets.partial.has(malId);
}

export function getDubStatusProviderHealth(): ProviderHealth {
  return {
    name: "MyDubList",
    role: "metadata",
    status: "ready",
    notes:
      "English dub status for catalog titles AnimeSchedule doesn't track. " +
      MYDUBLIST_ATTRIBUTION,
  };
}
