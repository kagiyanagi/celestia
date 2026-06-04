import { getAnimeScheduleProviderHealth } from "@/lib/providers/anime-schedule";
import { getDubStatusProviderHealth } from "@/lib/providers/dub-status";
import { getJikanProviderHealth } from "@/lib/providers/jikan";
import { getStreamingProviderHealth } from "@/lib/providers/streaming";
import { getTmdbProviderHealth } from "@/lib/providers/tmdb";
import type { ProviderHealth } from "@/types/anime";

export function getProviderHealth(): ProviderHealth[] {
  return [
    {
      name: "AniList",
      role: "tracking",
      status: "ready",
      notes: "Primary catalog, account tracking, discovery, characters, and airing data."
    },
    {
      name: "AniZip",
      role: "metadata",
      status: "ready",
      notes: "Episode metadata and cross-platform ID mappings (MAL, TVDB, TMDB, Kitsu)."
    },
    getJikanProviderHealth(),
    getTmdbProviderHealth(),
    getAnimeScheduleProviderHealth(),
    getDubStatusProviderHealth(),
    getStreamingProviderHealth()
  ];
}
