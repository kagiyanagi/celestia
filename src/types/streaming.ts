export type StreamAudioType = "sub" | "dub";

export type StreamEpisode = {
  number: number;
  title: string;
};

export type StreamAvailability = {
  available: boolean;
  provider: string;
  providerAnimeId: number | null;
  episodeCount: number | null;
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
};

export type StreamProviderOption = {
  id: string;
  label: string;
};

export type StreamingProvider = {
  id: string;
  label: string;
  findAvailability(title: string): Promise<StreamAvailability>;
  getSource(input: {
    animeTitle: string;
    providerAnimeId?: number | null;
    episode: number;
    audio?: StreamAudioType | null;
  }): Promise<StreamSource | null>;
};
