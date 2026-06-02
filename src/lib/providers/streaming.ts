import { streaming-providerProvider } from "@/lib/providers/streaming-provider";
import type { ProviderHealth } from "@/types/anime";
import type { StreamAvailability, StreamingProvider, StreamSource } from "@/types/streaming";

const providers: Record<string, StreamingProvider> = {
  streaming-provider: streaming-providerProvider
};

function getActiveProvider(): StreamingProvider | null {
  const providerId = process.env.STREAMING_PROVIDER || "streaming-provider";

  return providers[providerId] || providers.streaming-provider || null;
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

export async function findStreamAvailability(title: string | string[]): Promise<StreamAvailability> {
  const provider = getActiveProvider();

  if (!provider) {
    return {
      available: false,
      provider: "None",
      providerAnimeId: null,
      episodeCount: null
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
    episodeCount: null
  };
}

export async function getStreamSource(input: {
  animeTitle: string | string[];
  providerAnimeId?: number | null;
  episode: number;
}): Promise<StreamSource | null> {
  const provider = getActiveProvider();

  if (!provider) {
    return null;
  }

  const candidates = getTitleCandidates(input.animeTitle);
  const providerAnimeId =
    input.providerAnimeId || (await findStreamAvailability(candidates)).providerAnimeId;

  if (!providerAnimeId) {
    return null;
  }

  return provider.getSource({
    animeTitle: candidates[0] || "",
    providerAnimeId,
    episode: input.episode
  });
}

export function getStreamingProviderHealth(): ProviderHealth {
  const provider = getActiveProvider();

  return {
    name: "Streaming",
    role: "streaming",
    status: provider ? "ready" : "disabled",
    notes: provider
      ? "A playback provider is active and isolated behind the streaming adapter."
      : "No playback provider is configured."
  };
}
