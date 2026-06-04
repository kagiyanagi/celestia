import { fetchJson } from "@/lib/http/client";
import type {
  StreamAudioType,
  StreamAvailability,
  StreamEpisode,
  StreamingProvider,
  StreamReferrerPolicy,
  StreamSource,
} from "@/types/streaming";

export type StreamingAdapterConfig = {
  id: string;
  label: string;
  url: string;
  priority?: number;
  // "search" (default) = title search + episode-count verification against the
  // provider's catalog. "embed" = deterministic AniList-id-keyed URL template.
  kind?: "search" | "embed";
  // Iframe referrer policy for this provider's sources. Omit for the default
  // "no-referrer"; set it when an embed host only resolves with a Referer.
  referrerPolicy?: StreamReferrerPolicy;
};

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

function cleanBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
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

export function createStreamingAdapter(
  config: StreamingAdapterConfig,
): StreamingProvider {
  const baseUrl = cleanBaseUrl(config.url);
  const isConfigured = Boolean(baseUrl);

  async function getJson<T>(
    path: string,
    revalidate: number,
    timeoutMs = 4_500,
  ): Promise<T | null> {
    if (!isConfigured) {
      return null;
    }

    try {
      return await fetchJson<T>(
        `${baseUrl}${path}`,
        {
          next: { revalidate },
        },
        {
          provider: config.label,
          timeoutMs,
          retries: 1,
          retryDelayMs: 250,
          cacheKey: `${config.id}:${path}`,
          staleTtlMs: revalidate * 1000 * 6,
        },
      );
    } catch (error) {
      console.warn(`${config.label} request failed for ${path}`, error);
      return null;
    }
  }

  async function findAvailability(title: string): Promise<StreamAvailability> {
    const payload = await getJson<StreamingFindResponse>(
      `/api/find/${encodeURIComponent(title)}`,
      60 * 60,
      2_500,
    );

    return {
      available: Boolean(payload?.exist),
      providerId: config.id,
      provider: config.label,
      providerAnimeId: payload?.id || null,
      episodeCount: payload?.ep || null,
    };
  }

  async function getEpisodesPayload(
    animeId: number,
  ): Promise<StreamingEpisodeResponse | null> {
    return getJson<StreamingEpisodeResponse>(
      `/v1/api/details/${animeId}`,
      60 * 10,
      5_000,
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
      providerId: config.id,
      provider: config.label,
      animeId: providerAnimeId,
      episode,
      audio,
      availableAudio,
      embedUrl,
      episodes: toEpisodeList(episodesPayload),
    };
  }

  return {
    id: config.id,
    label: config.label,
    priority: config.priority ?? 100,
    isConfigured,
    findAvailability,
    getSource,
  };
}

export const streamingAdapter = createStreamingAdapter({
  id: process.env.STREAMING_PROVIDER_ID || "custom",
  label: process.env.STREAMING_PROVIDER_LABEL || "Custom Provider",
  url: process.env.STREAMING_PROVIDER_URL || "",
  priority: 100,
});
