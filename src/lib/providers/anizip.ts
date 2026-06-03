import { fetchJson } from "@/lib/http/client";
import type { AnimeStreamingEpisode } from "@/types/anime";

const ANIZIP_ENDPOINT = "https://api.ani.zip/mappings";
const MAX_INFERRED_TVDB_IMAGE_GAP = 80;

type AniZipResponse = {
  episodes?: Record<
    string,
    {
      tvdbShowId?: number;
      tvdbId?: number;
      title?: {
        en?: string;
        "x-jat"?: string;
        ja?: string;
      };
      overview?: string;
      summary?: string;
      image?: string;
  }
>;
};

function getTvdbEpisodeImage(showId: number, episodeId: number): string {
  return `https://artworks.thetvdb.com/banners/episodes/${showId}/${episodeId}.jpg`;
}

export async function getAniZipEpisodes(
  anilistId: number,
): Promise<AnimeStreamingEpisode[]> {
  try {
    const data = await fetchJson<AniZipResponse>(
      `${ANIZIP_ENDPOINT}?anilist_id=${anilistId}`,
      {
        next: { revalidate: 86400 },
      },
      {
        provider: "AniZip",
        timeoutMs: 7_000,
        retries: 2,
        retryDelayMs: 500,
        cacheKey: `anizip:${anilistId}`,
        staleTtlMs: 86400 * 1000 * 7,
      },
    );

    if (!data || !data.episodes) return [];

    const episodes = data.episodes;
    let lastTvdb:
      | {
          episodeNumber: number;
          showId: number;
          episodeId: number;
        }
      | null = null;

    return Object.keys(episodes)
      .filter((key) => !isNaN(Number(key))) // Ensure we only get numbered episodes
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => {
        const number = Number(key);
        const ep = episodes[key];
        // Priority for title: English -> Japanese (Romaji) -> Fallback
        const title =
          ep.title?.en || ep.title?.["x-jat"] || ep.title?.ja || null;
        const explicitTvdbImage =
          ep.tvdbShowId && ep.tvdbId
            ? getTvdbEpisodeImage(ep.tvdbShowId, ep.tvdbId)
            : null;
        const tvdbGap = lastTvdb ? number - lastTvdb.episodeNumber : 0;
        const inferredTvdbImage =
          lastTvdb && tvdbGap > 0 && tvdbGap <= MAX_INFERRED_TVDB_IMAGE_GAP
          ? getTvdbEpisodeImage(
              lastTvdb.showId,
              lastTvdb.episodeId + tvdbGap,
            )
          : null;

        if (ep.tvdbShowId && ep.tvdbId) {
          lastTvdb = {
            episodeNumber: number,
            showId: ep.tvdbShowId,
            episodeId: ep.tvdbId,
          };
        }

        return {
          number,
          title: title,
          thumbnail: ep.image || explicitTvdbImage || inferredTvdbImage,
          description: ep.overview || ep.summary || null,
          url: null,
          site: "TVDB",
        };
      });
  } catch (error) {
    console.error("AniZip fetch error:", error);
    return [];
  }
}
