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
  provider: string;
  animeId: number;
  episode: number;
  embedUrl: string | null;
  episodes: StreamEpisode[];
};

export type StreamingProvider = {
  id: string;
  label: string;
  findAvailability(title: string): Promise<StreamAvailability>;
  getSource(input: {
    animeTitle: string;
    providerAnimeId?: number | null;
    episode: number;
  }): Promise<StreamSource | null>;
};
