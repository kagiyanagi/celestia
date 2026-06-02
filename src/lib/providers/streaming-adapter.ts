import type {
  StreamAudioType,
  StreamAvailability,
  StreamEpisode,
  StreamingProvider,
  StreamSource,
} from "@/types/streaming";

const STREAMING_PROVIDER_BASE_URL = process.env.STREAMING_PROVIDER_BASE_URL || "https://streaming-provider.xyz";

type Streaming ProviderFindResponse = {
  exist?: boolean;
  id?: number;
  ep?: number;
};

type Streaming ProviderEpisodeResponse = {
  local?: {
    link?: string;
    title?: string;
    ep?: Array<{
      link?: string;
      title?: string;
    }>;
  };
};

const AUDIO_OPTIONS: StreamAudioType[] = ["sub", "dub"];

function isStreamingEnabled(): boolean {
  return (process.env.STREAMING_PROVIDER || "streaming-provider") === "streaming-provider";
}

async function getJson<T>(path: string, revalidate: number): Promise<T | null> {
  if (!isStreamingEnabled()) {
    return null;
  }

  const response = await fetch(`${STREAMING_PROVIDER_BASE_URL}${path}`, {
    next: { revalidate }
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as T;
}

function cleanStreamLink(value: string | null | undefined): string | null {
  const direct = value?.replace(/^src=/i, "");

  if (direct?.startsWith("https://")) {
    return direct;
  }

  if (direct?.startsWith("//")) {
    return `https:${direct}`;
  }

  return null;
}

function detectAudioType(value: string | null | undefined): StreamAudioType | null {
  const match = cleanStreamLink(value)?.match(/\/(sub|dub)(?:[/?#]|$)/i);

  return match ? (match[1].toLowerCase() as StreamAudioType) : null;
}

function setAudioType(
  value: string | null | undefined,
  audio: StreamAudioType | null | undefined,
): string | null {
  const link = cleanStreamLink(value);

  if (!link || !audio) {
    return link;
  }

  return link.replace(/\/(sub|dub)(?=[/?#]|$)/i, `/${audio}`);
}

async function findStreaming ProviderAvailability(title: string): Promise<StreamAvailability> {
  const payload = await getJson<Streaming ProviderFindResponse>(
    `/api/find/${encodeURIComponent(title)}`,
    60 * 60 * 6
  );

  return {
    available: Boolean(payload?.exist),
    provider: streaming-providerProvider.label,
    providerAnimeId: payload?.id || null,
    episodeCount: payload?.ep || null
  };
}

function toEpisodeList(payload: Streaming ProviderEpisodeResponse | null): StreamEpisode[] {
  const firstEpisode = payload?.local?.link
    ? [
        {
          number: 1,
          title: payload.local.title || "Episode 1"
        }
      ]
    : [];

  const rest =
    payload?.local?.ep?.map((episode, index) => ({
      number: index + 2,
      title: episode.title || `Episode ${index + 2}`
    })) || [];

  return [...firstEpisode, ...rest];
}

function getRawEpisodeLink(
  payload: Streaming ProviderEpisodeResponse | null,
  episode: number,
): string | null | undefined {
  if (episode === 1) {
    return payload?.local?.link;
  }

  return payload?.local?.ep?.[episode - 2]?.link;
}

function clampEpisode(episode: number): number {
  if (!Number.isFinite(episode)) {
    return 1;
  }

  return Math.max(1, Math.floor(episode));
}

async function getEpisodesPayload(animeId: number): Promise<Streaming ProviderEpisodeResponse | null> {
  return getJson<Streaming ProviderEpisodeResponse>(`/v1/api/details/${animeId}`, 60 * 10);
}

async function getStreaming ProviderSource(input: {
  animeTitle: string;
  providerAnimeId?: number | null;
  episode: number;
  audio?: StreamAudioType | null;
}): Promise<StreamSource | null> {
  const providerAnimeId =
    input.providerAnimeId ||
    (await findStreaming ProviderAvailability(input.animeTitle)).providerAnimeId;

  if (!providerAnimeId) {
    return null;
  }

  const episode = clampEpisode(input.episode);
  const episodesPayload = await getEpisodesPayload(providerAnimeId);
  const rawEpisodeLink = getRawEpisodeLink(episodesPayload, episode);
  const detectedAudio = detectAudioType(rawEpisodeLink);
  const audio = input.audio || detectedAudio;
  const embedUrl = setAudioType(rawEpisodeLink, audio);
  const availableAudio = detectedAudio ? AUDIO_OPTIONS : [];

  return {
    providerId: streaming-providerProvider.id,
    provider: streaming-providerProvider.label,
    animeId: providerAnimeId,
    episode,
    audio,
    availableAudio,
    embedUrl,
    episodes: toEpisodeList(episodesPayload),
  };
}

export const streaming-providerProvider: StreamingProvider = {
  id: "streaming-provider",
  label: "Streaming Provider",
  findAvailability: findStreaming ProviderAvailability,
  getSource: getStreaming ProviderSource
};
