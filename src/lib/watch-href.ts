import type { StreamAudioType } from "@/types/streaming";

/**
 * Single source of truth for `/watch/[id]` URLs. Used by the server-rendered
 * page, the in-place player panel (history sync), and the episode browser so
 * every watch link carries the same server/audio/sid selection.
 */
export function buildWatchHref(input: {
  animeId: number;
  episode: number;
  page?: number | null;
  providerAnimeId?: number | null;
  providerId?: string | null;
  order?: "asc" | "desc" | null;
  audio?: StreamAudioType | null;
}): string {
  const params = new URLSearchParams({ ep: String(input.episode) });

  if (input.page) {
    params.set("page", String(input.page));
  }

  if (input.order) {
    params.set("order", input.order);
  }

  if (input.providerAnimeId) {
    params.set("sid", String(input.providerAnimeId));
  }

  if (input.providerId) {
    params.set("server", input.providerId);
  }

  if (input.audio) {
    params.set("audio", input.audio);
  }

  return `/watch/${input.animeId}?${params.toString()}`;
}
