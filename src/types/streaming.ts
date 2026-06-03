export type StreamAudioType = "sub" | "dub";

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
  findAvailability(title: string): Promise<StreamAvailability>;
  getSource(input: {
    animeTitle: string;
    providerAnimeId?: number | null;
    episode: number;
    audio?: StreamAudioType | null;
    expectedEpisodes?: number | null;
  }): Promise<StreamSource | null>;
};
