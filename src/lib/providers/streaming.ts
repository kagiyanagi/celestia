import { streamingAdapter } from "@/lib/providers/streaming-adapter";
import type { ProviderHealth } from "@/types/anime";
import type {
  StreamAudioType,
  StreamAvailability,
  StreamingProvider,
  StreamProviderOption,
  StreamSource,
} from "@/types/streaming";

const STREAMING_PROVIDER_ID = process.env.STREAMING_PROVIDER_ID || "custom";

const providers: Record<string, StreamingProvider> = {
  [STREAMING_PROVIDER_ID]: streamingAdapter,
};

function getProvider(providerId?: string | null): StreamingProvider | null {
  const fallbackProviderId = process.env.STREAMING_PROVIDER_ID || "custom";
  const selectedProviderId = providerId || fallbackProviderId;

  return (
    providers[selectedProviderId] ||
    providers[fallbackProviderId] ||
    providers[STREAMING_PROVIDER_ID] ||
    null
  );
}

function toTitleCase(title: string): string {
  return title
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .replace(/\bTv\b/g, "TV")
    .replace(/\bIi\b/g, "II")
    .replace(/\bIii\b/g, "III")
    .replace(/\bIv\b/g, "IV");
}

function getTitleCandidates(title: string | string[]): string[] {
  const titles = Array.isArray(title) ? title : [title];

  const candidates = titles.flatMap((item) => {
    const trimmed = item.trim();
    if (!trimmed) return [];

    const variations = [trimmed];

    // Remove technical suffixes like (TV), (ONA), (Movie)
    const withoutSuffix = trimmed.replace(
      /\s*\((TV|ONA|OAV|OVA|Movie|Special|Desktop)\)$/i,
      "",
    );
    if (withoutSuffix !== trimmed) variations.push(withoutSuffix);

    // Handle Season variations
    // "Season 2" -> "2" and "S2"
    const withoutSeasonWord = trimmed.replace(/\s+Season\s+(\d+)/i, " $1");
    if (withoutSeasonWord !== trimmed) {
      variations.push(withoutSeasonWord);
      variations.push(trimmed.replace(/\s+Season\s+(\d+)/i, " S$1"));
    }

    // "2nd Season" -> "Season 2" and "S2"
    const ordinalToSeason = trimmed.replace(
      /(\d+)(st|nd|rd|th)\s+Season/i,
      "Season $1",
    );
    if (ordinalToSeason !== trimmed) {
      variations.push(ordinalToSeason);
      variations.push(trimmed.replace(/(\d+)(st|nd|rd|th)\s+Season/i, "S$1"));
    }

    // Try without subtitle (everything after colon)
    if (trimmed.includes(":")) {
      variations.push(trimmed.split(":")[0].trim());
    }

    // Try without subtitle (everything after dash)
    if (trimmed.includes(" - ")) {
      variations.push(trimmed.split(" - ")[0].trim());
    }

    return variations.flatMap((v) => [v, toTitleCase(v)]);
  });

  return Array.from(new Set(candidates));
}

export async function findStreamAvailability(
  title: string | string[],
  providerId?: string | null,
): Promise<StreamAvailability> {
  const provider = getProvider(providerId);

  if (!provider) {
    return {
      available: false,
      provider: "None",
      providerAnimeId: null,
      episodeCount: null,
    };
  }

  for (const candidate of getTitleCandidates(title)) {
    const availability = await provider.findAvailability(candidate);

    if (availability.available) {
      return availability;
    }
  }

  return {
    available: false,
    provider: provider.label,
    providerAnimeId: null,
    episodeCount: null,
  };
}

export async function getStreamSource(input: {
  animeTitle: string | string[];
  providerAnimeId?: number | null;
  episode: number;
  providerId?: string | null;
  audio?: StreamAudioType | null;
}): Promise<StreamSource | null> {
  const provider = getProvider(input.providerId);

  if (!provider) {
    return null;
  }

  const candidates = getTitleCandidates(input.animeTitle);
  const providerAnimeId =
    input.providerAnimeId ||
    (await findStreamAvailability(candidates, input.providerId))
      .providerAnimeId;

  if (!providerAnimeId) {
    return null;
  }

  return provider.getSource({
    animeTitle: candidates[0] || "",
    providerAnimeId,
    episode: input.episode,
    audio: input.audio,
  });
}

export function getActiveStreamingProviderId(
  providerId?: string | null,
): string | null {
  return getProvider(providerId)?.id || null;
}

export function getStreamingProviderOptions(): StreamProviderOption[] {
  return Object.values(providers).map((provider) => ({
    id: provider.id,
    label: provider.label,
  }));
}

export function isStreamingConfigured(): boolean {
  return streamingAdapter.isConfigured;
}

export function getStreamingProviderHealth(): ProviderHealth {
  const provider = getProvider() as
    | (StreamingProvider & { isConfigured?: boolean })
    | null;
  const isReady = provider?.isConfigured;

  return {
    name: "Streaming",
    role: "streaming",
    status: isReady ? "ready" : "disabled",
    notes: isReady
      ? `A playback provider (${provider.label}) is active. Isolated behind the streaming adapter.`
      : "No playback provider is configured. Bring your own API here by setting STREAMING_PROVIDER_URL.",
  };
}
