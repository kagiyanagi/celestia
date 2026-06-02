import { getStreamingProviderHealth } from "@/lib/providers/streaming";
import type { ProviderHealth } from "@/types/anime";

export function getProviderHealth(): ProviderHealth[] {
  return [
    {
      name: "AniList",
      role: "tracking",
      status: "ready",
      notes: "Primary catalog, account tracking, discovery, characters, and airing data."
    },
    getStreamingProviderHealth()
  ];
}
