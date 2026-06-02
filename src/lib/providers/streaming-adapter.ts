import type {
  StreamAudioType,
  StreamAvailability,
  StreamEpisode,
  StreamingProvider,
  StreamSource,
} from "@/types/streaming";

const STREAMING_PROVIDER_URL = process.env.STREAMING_PROVIDER_URL || "";
const STREAMING_PROVIDER_LABEL =
  process.env.STREAMING_PROVIDER_LABEL || "Custom Provider";
const STREAMING_PROVIDER_ID = process.env.STREAMING_PROVIDER_ID || "custom";

type StreamingFindResponse = {
  exist?: boolean;
  id?: number;
  ep?: number;
};

type StreamingEpisodeResponse = {
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
  return Boolean(STREAMING_PROVIDER_URL);
}

async function getJson<T>(path: string, revalidate: number): Promise<T | null> {
  if (!isStreamingEnabled()) {
    return null;
  }

  const response = await fetch(`${STREAMING_PROVIDER_URL}${path}`, {
    next: { revalidate },
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

function detectAudioType(
  value: string | null | undefined,
): StreamAudioType | null {
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

async function findAvailability(title: string): Promise<StreamAvailability> {
  const payload = await getJson<StreamingFindResponse>(
    `/api/find/${encodeURIComponent(title)}`,
    60 * 60 * 1,
  );

  return {
    available: Boolean(payload?.exist),
    provider: streamingAdapter.label,
    providerAnimeId: payload?.id || null,
    episodeCount: payload?.ep || null,
  };
}

function toEpisodeList(
  payload: StreamingEpisodeResponse | null,
): StreamEpisode[] {
  const firstEpisode = payload?.local?.link
    ? [
        {
          number: 1,
          title: payload.local.title || "Episode 1",
        },
      ]
    : [];

  const rest =
    payload?.local?.ep?.map((episode, index) => ({
      number: index + 2,
      title: episode.title || `Episode ${index + 2}`,
    })) || [];

  return [...firstEpisode, ...rest];
}

function getRawEpisodeLink(
  payload: StreamingEpisodeResponse | null,
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

async function getEpisodesPayload(
  animeId: number,
): Promise<StreamingEpisodeResponse | null> {
  return getJson<StreamingEpisodeResponse>(
    `/v1/api/details/${animeId}`,
    60 * 10,
  );
}

async function getSource(input: {
  animeTitle: string;
  providerAnimeId?: number | null;
  episode: number;
  audio?: StreamAudioType | null;
}): Promise<StreamSource | null> {
  const providerAnimeId =
    input.providerAnimeId ||
    (await findAvailability(input.animeTitle)).providerAnimeId;

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
    providerId: streamingAdapter.id,
    provider: streamingAdapter.label,
    animeId: providerAnimeId,
    episode,
    audio,
    availableAudio,
    embedUrl,
    episodes: toEpisodeList(episodesPayload),
  };
}

export const streamingAdapter: StreamingProvider & { isConfigured: boolean } = {
  id: STREAMING_PROVIDER_ID,
  label: STREAMING_PROVIDER_LABEL,
  isConfigured: isStreamingEnabled(),
  findAvailability,
  getSource,
};
