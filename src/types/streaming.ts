export type StreamAudioType = "sub" | "dub";

// Per-source iframe referrer policy. Defaults to "no-referrer" everywhere; an
// embed host that only resolves when it receives a Referer can opt into sending
// one (the browser's normal behavior - still iframe-only, no proxying).
export type StreamReferrerPolicy =
  | "no-referrer"
  | "origin"
  | "origin-when-cross-origin"
  | "strict-origin-when-cross-origin"
  | "unsafe-url";

export type StreamEpisode = {
  number: number;
  title: string;
};

export type StreamAvailability = {
  available: boolean;
  providerId: string | null;
  provider: string;
  providerAnimeId: number | null;
  episodeCount: number | null;
  score?: number;
};

export type StreamFallbackSource = {
  providerId: string;
  provider: string;
  animeId: number;
  embedUrl: string;
  audio: StreamAudioType | null;
  referrerPolicy?: StreamReferrerPolicy;
};

export type StreamSource = {
  providerId: string;
  provider: string;
  animeId: number;
  episode: number;
  audio: StreamAudioType | null;
  availableAudio: StreamAudioType[];
  embedUrl: string | null;
  episodes: StreamEpisode[];
  referrerPolicy?: StreamReferrerPolicy;
  fallbacks?: StreamFallbackSource[];
  attemptedProviders?: string[];
};

export type StreamProviderOption = {
  id: string;
  label: string;
  available: boolean;
};

export type StreamingProvider = {
  id: string;
  label: string;
  priority: number;
  isConfigured: boolean;
  // True for embed providers keyed by AniList id rather than a title search.
  // The orchestrator resolves these directly from the AniList id and skips
  // title-guessing / episode-count verification - there is no wrong-season
  // risk when the id is exact.
  keysByAnilistId?: boolean;
  findAvailability(
    title: string,
    anilistId?: number | null,
  ): Promise<StreamAvailability>;
  getSource(input: {
    animeTitle: string;
    providerAnimeId?: number | null;
    episode: number;
    audio?: StreamAudioType | null;
    expectedEpisodes?: number | null;
    anilistId?: number | null;
  }): Promise<StreamSource | null>;
};
