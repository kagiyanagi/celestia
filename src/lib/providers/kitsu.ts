import { fetchJson, ProviderFetchError } from "@/lib/http/client";

const KITSU_ENDPOINT = "https://kitsu.app/api/edge";
const PAGE_SIZE = 20;
// Backstop on how deep we page. Kitsu backfills episode stills from the start
// of a series, so coverage is early-contiguous and we stop one batch after it
// runs out (see getKitsuEpisodeStills). This only caps pathological cases.
const MAX_PAGES = 30;
const BATCH_PAGES = 4;

/**
 * One Kitsu episode, reduced to the fields we use: the still image plus enough
 * identity (number/title/airDate) for the consumer to verify that Kitsu's
 * numbering aligns with our catalog before trusting its thumbnails.
 */
export type KitsuEpisode = {
  number: number;
  thumbnail: string | null;
  title: string | null;
  airDate: string | null;
};

type KitsuThumbnail = {
  original?: string | null;
  large?: string | null;
};

type KitsuEpisodeResource = {
  attributes?: {
    number?: number | null;
    canonicalTitle?: string | null;
    airdate?: string | null;
    thumbnail?: KitsuThumbnail | null;
  };
};

type KitsuEpisodesResponse = {
  data?: KitsuEpisodeResource[];
  meta?: { count?: number };
};

const KITSU_HEADERS = {
  Accept: "application/vnd.api+json",
  // Kitsu rejects requests without a User-Agent (403).
  "User-Agent": "celestia/1.0 (+https://github.com/celestia)",
};

function pickThumbnail(thumbnail: KitsuThumbnail | null | undefined): string | null {
  return thumbnail?.original || thumbnail?.large || null;
}

function toEpisode(resource: KitsuEpisodeResource): KitsuEpisode | null {
  const attributes = resource.attributes;
  const number = attributes?.number;

  if (!Number.isFinite(number) || (number ?? 0) <= 0) {
    return null;
  }

  return {
    number: Math.floor(number as number),
    thumbnail: pickThumbnail(attributes?.thumbnail),
    title: attributes?.canonicalTitle?.trim() || null,
    airDate: attributes?.airdate?.slice(0, 10) || null,
  };
}

type KitsuPage = {
  episodes: KitsuEpisode[];
  total: number | null;
};

async function fetchPage(
  kitsuId: number,
  offset: number,
): Promise<KitsuPage | null> {
  const params = new URLSearchParams({
    "page[limit]": String(PAGE_SIZE),
    "page[offset]": String(offset),
    sort: "number",
  });

  const data = await fetchJson<KitsuEpisodesResponse>(
    `${KITSU_ENDPOINT}/anime/${kitsuId}/episodes?${params.toString()}`,
    {
      headers: KITSU_HEADERS,
      next: { revalidate: 86400 },
    },
    {
      provider: "Kitsu",
      timeoutMs: 6_000,
      retries: 1,
      retryDelayMs: 500,
      cacheKey: `kitsu:episodes:${kitsuId}:${offset}`,
      staleTtlMs: 86400 * 1000 * 7,
    },
  );

  if (!data) return null;

  return {
    episodes: (data.data || [])
      .map(toEpisode)
      .filter((episode): episode is KitsuEpisode => episode !== null),
    total: Number.isFinite(data.meta?.count) ? (data.meta?.count ?? null) : null,
  };
}

/**
 * Episode stills from Kitsu, used to fill gaps the TVDB/AniList sources leave.
 *
 * Kitsu is reached through ani.zip's per-AniList-entry `kitsu_id`, so its
 * numbering aligns with the catalog entry (unlike TMDB, which only models the
 * whole franchise) — but the caller still verifies alignment before trusting
 * the images. Pages are fetched in bounded parallel batches and we stop one
 * batch after thumbnails run out, since Kitsu backfills stills from the start
 * of a series. `maxNumber` (the highest still-less episode) keeps us from
 * paging past where a gap could be filled.
 */
export async function getKitsuEpisodeStills(
  kitsuId: number,
  options: { maxNumber?: number | null } = {},
): Promise<KitsuEpisode[]> {
  try {
    const first = await fetchPage(kitsuId, 0);
    if (!first) return [];

    const ceiling = Math.min(
      MAX_PAGES,
      first.total ? Math.ceil(first.total / PAGE_SIZE) : MAX_PAGES,
      options.maxNumber && options.maxNumber > 0
        ? Math.ceil(options.maxNumber / PAGE_SIZE)
        : MAX_PAGES,
    );

    const collected = [...first.episodes];
    let lastBatchHadThumbnail = first.episodes.some((ep) => ep.thumbnail);

    for (
      let page = 1;
      page < ceiling && lastBatchHadThumbnail;
      page += BATCH_PAGES
    ) {
      const offsets: number[] = [];
      for (let p = page; p < Math.min(page + BATCH_PAGES, ceiling); p += 1) {
        offsets.push(p * PAGE_SIZE);
      }

      const pages = await Promise.all(
        offsets.map((offset) => fetchPage(kitsuId, offset)),
      );

      lastBatchHadThumbnail = false;
      for (const result of pages) {
        if (!result) continue;
        collected.push(...result.episodes);
        if (result.episodes.some((ep) => ep.thumbnail)) {
          lastBatchHadThumbnail = true;
        }
      }
    }

    return collected;
  } catch (error) {
    if (error instanceof ProviderFetchError && error.status === 404) {
      return [];
    }

    console.warn("Kitsu fetch error:", error);
    return [];
  }
}
