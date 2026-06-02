import { streaming-providerProvider } from "@/lib/providers/streaming-provider";
import type { ProviderHealth } from "@/types/anime";
import type {
  StreamAudioType,
  StreamAvailability,
  StreamingProvider,
  StreamProviderOption,
  StreamSource,
} from "@/types/streaming";

const providers: Record<string, StreamingProvider> = {
  streaming-provider: streaming-providerProvider,
};

function getProvider(providerId?: string | null): StreamingProvider | null {
  const fallbackProviderId = process.env.STREAMING_PROVIDER || "streaming-provider";
  const selectedProviderId = providerId || fallbackProviderId;

  return (
    providers[selectedProviderId] ||
    providers[fallbackProviderId] ||
    providers.streaming-provider ||
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

    if (!trimmed) {
      return [];
    }

    return [trimmed, toTitleCase(trimmed)];
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
    (await findStreamAvailability(candidates, input.providerId)).providerAnimeId;

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

export function getStreamingProviderHealth(): ProviderHealth {
  const provider = getProvider();

  return {
    name: "Streaming",
    role: "streaming",
    status: provider ? "ready" : "disabled",
    notes: provider
      ? "A playback provider is active and isolated behind the streaming adapter."
      : "No playback provider is configured.",
  };
}
