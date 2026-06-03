import {
  createStreamingAdapter,
  streamingAdapter,
  type StreamingAdapterConfig,
} from "@/lib/providers/streaming-adapter";
import type { ProviderHealth } from "@/types/anime";
import type {
  StreamAudioType,
  StreamAvailability,
  StreamFallbackSource,
  StreamingProvider,
  StreamProviderOption,
  StreamSource,
} from "@/types/streaming";

const LEGACY_PROVIDER_ID = process.env.STREAMING_PROVIDER_ID || "custom";

type RawStreamingProviderConfig = {
  id?: unknown;
  label?: unknown;
  url?: unknown;
  priority?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toProviderConfig(
  value: RawStreamingProviderConfig,
  index: number,
): StreamingAdapterConfig | null {
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const url = typeof value.url === "string" ? value.url.trim() : "";

  if (!id || !url) {
    return null;
  }

  return {
    id,
    url,
    label:
      typeof value.label === "string" && value.label.trim()
        ? value.label.trim()
        : id,
    priority:
      typeof value.priority === "number" && Number.isFinite(value.priority)
        ? value.priority
        : 100 + index,
  };
}

function parseStreamingProviders(): StreamingAdapterConfig[] {
  const raw = process.env.STREAMING_PROVIDERS;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isRecord)
      .map(toProviderConfig)
      .filter((config): config is StreamingAdapterConfig => Boolean(config));
  } catch (error) {
    console.warn("STREAMING_PROVIDERS must be a JSON array.", error);
    return [];
  }
}

function getProviderConfigs(): StreamingAdapterConfig[] {
  const configuredProviders = parseStreamingProviders();

  if (configuredProviders.length > 0) {
    return configuredProviders.sort((a, b) => {
      const priorityDiff = (a.priority ?? 100) - (b.priority ?? 100);
      return priorityDiff || a.id.localeCompare(b.id);
    });
  }

  return [
    {
      id: LEGACY_PROVIDER_ID,
      label: process.env.STREAMING_PROVIDER_LABEL || "Custom Provider",
      url: process.env.STREAMING_PROVIDER_URL || "",
      priority: 100,
    },
  ];
}

const providers = getProviderConfigs()
  .map((config) =>
    config.id === streamingAdapter.id &&
    config.url === process.env.STREAMING_PROVIDER_URL
      ? streamingAdapter
      : createStreamingAdapter(config),
  )
  .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));

function calculateAlignmentScore(
  expectedEps: number | null,
  foundEps: number | null,
  candidateIndex: number,
  providerPriority: number,
): number {
  let score = 100 - candidateIndex * 10 - Math.max(0, providerPriority - 100);

  if (expectedEps && foundEps) {
    const diff = Math.abs(expectedEps - foundEps);
    if (diff === 0) {
      score += 50;
    } else if (diff <= 2) {
      score += 20;
    } else {
      score -= 80;
    }
  }

  return score;
}

function getConfiguredProviders(): StreamingProvider[] {
  return providers.filter((provider) => provider.isConfigured);
}

function getProvider(providerId?: string | null): StreamingProvider | null {
  const selectedProvider = providerId
    ? providers.find((provider) => provider.id === providerId) || null
    : null;

  return (
    selectedProvider ||
    getConfiguredProviders()[0] ||
    providers.find((provider) => provider.id === LEGACY_PROVIDER_ID) ||
    providers[0] ||
    null
  );
}

function getProviderSearchOrder(providerId?: string | null): StreamingProvider[] {
  const configuredProviders = getConfiguredProviders();
  const selectedProvider = providerId
    ? configuredProviders.find((provider) => provider.id === providerId) || null
    : null;
  const orderedProviders = selectedProvider
    ? [
        selectedProvider,
        ...configuredProviders.filter(
          (provider) => provider.id !== selectedProvider.id,
        ),
      ]
    : configuredProviders;

  return orderedProviders.length ? orderedProviders : providers;
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
    const withoutSuffix = trimmed.replace(
      /\s*\((TV|ONA|OAV|OVA|Movie|Special|Desktop)\)$/i,
      "",
    );
    if (withoutSuffix !== trimmed) variations.push(withoutSuffix);

    const withoutSeasonWord = trimmed.replace(/\s+Season\s+(\d+)/i, " $1");
    if (withoutSeasonWord !== trimmed) {
      variations.push(withoutSeasonWord);
      variations.push(trimmed.replace(/\s+Season\s+(\d+)/i, " S$1"));
    }

    const ordinalToSeason = trimmed.replace(
      /(\d+)(st|nd|rd|th)\s+Season/i,
      "Season $1",
    );
    if (ordinalToSeason !== trimmed) {
      variations.push(ordinalToSeason);
      variations.push(trimmed.replace(/(\d+)(st|nd|rd|th)\s+Season/i, "S$1"));
    }

    const trailingNumber = trimmed.match(/(.*)\s+(\d+)$/);
    if (
      trailingNumber &&
      !trimmed.toLowerCase().includes("season") &&
      !trimmed.toLowerCase().includes("part")
    ) {
      variations.push(`${trailingNumber[1]} Season ${trailingNumber[2]}`);
      variations.push(`${trailingNumber[1]} S${trailingNumber[2]}`);
    }

    const withPart = trimmed.replace(/\s+Part\s+(\d+)/i, " Season $1");
    if (withPart !== trimmed) {
      variations.push(withPart);
      variations.push(trimmed.replace(/\s+Part\s+(\d+)/i, " $1"));
      variations.push(trimmed.replace(/\s+Part\s+(\d+)/i, " S$1"));
    }

    if (trimmed.includes(":")) {
      const mainTitle = trimmed.split(":")[0].trim();
      variations.push(mainTitle);

      const seasonMatch = trimmed.match(/Season\s+(\d+)/i);
      if (seasonMatch) {
        variations.push(`${mainTitle} Season ${seasonMatch[1]}`);
        variations.push(`${mainTitle} S${seasonMatch[1]}`);
      }

      const partMatch = trimmed.match(/(.*Part\s+\d+):/i);
      if (partMatch) {
        variations.push(partMatch[1].trim());
      }
    }

    if (trimmed.includes(" - ")) {
      variations.push(trimmed.split(" - ")[0].trim());
    }

    const withoutArticle = trimmed.replace(/^(A|An|The)\s+/i, "");
    if (withoutArticle !== trimmed) variations.push(withoutArticle);

    const alphanumeric = trimmed
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (alphanumeric !== trimmed) variations.push(alphanumeric);

    return variations.flatMap((v) => [v, toTitleCase(v)]);
  });

  return Array.from(new Set(candidates));
}

async function findProviderAvailability(input: {
  provider: StreamingProvider;
  candidates: string[];
  expectedEpisodes: number | null;
}): Promise<StreamAvailability | null> {
  const results: StreamAvailability[] = [];

  for (let i = 0; i < input.candidates.length; i += 1) {
    const availability = await input.provider.findAvailability(
      input.candidates[i],
    );

    if (availability.available) {
      availability.score = calculateAlignmentScore(
        input.expectedEpisodes,
        availability.episodeCount,
        i,
        input.provider.priority,
      );
      results.push(availability);

      if (availability.score >= 140) {
        return availability;
      }
    }
  }

  return results.sort((a, b) => (b.score || 0) - (a.score || 0))[0] || null;
}

export async function findStreamAvailability(
  title: string | string[],
  expectedEpisodes: number | null = null,
  providerId?: string | null,
): Promise<StreamAvailability> {
  const candidates = getTitleCandidates(title);
  const providersToTry = getProviderSearchOrder(providerId);
  const results: StreamAvailability[] = [];

  for (const provider of providersToTry) {
    const availability = await findProviderAvailability({
      provider,
      candidates,
      expectedEpisodes,
    });

    if (availability) {
      results.push(availability);
    }
  }

  if (results.length > 0) {
    return results.sort((a, b) => (b.score || 0) - (a.score || 0))[0];
  }

  const fallbackProvider = getProvider(providerId);

  return {
    available: false,
    providerId: fallbackProvider?.id || null,
    provider: fallbackProvider?.label || "None",
    providerAnimeId: null,
    episodeCount: null,
  };
}

async function getSourceFromProvider(input: {
  provider: StreamingProvider;
  candidates: string[];
  providerAnimeId?: number | null;
  episode: number;
  audio?: StreamAudioType | null;
  expectedEpisodes?: number | null;
}): Promise<StreamSource | null> {
  const providerAnimeId =
    input.providerAnimeId ||
    (
      await findProviderAvailability({
        provider: input.provider,
        candidates: input.candidates,
        expectedEpisodes: input.expectedEpisodes ?? null,
      })
    )?.providerAnimeId ||
    null;

  if (!providerAnimeId) {
    return null;
  }

  return input.provider.getSource({
    animeTitle: input.candidates[0] || "",
    providerAnimeId,
    episode: input.episode,
    audio: input.audio,
    expectedEpisodes: input.expectedEpisodes,
  });
}

function toFallbackSource(source: StreamSource): StreamFallbackSource | null {
  if (!source.embedUrl) {
    return null;
  }

  return {
    providerId: source.providerId,
    provider: source.provider,
    animeId: source.animeId,
    embedUrl: source.embedUrl,
    audio: source.audio,
  };
}

export async function getStreamSource(input: {
  animeTitle: string | string[];
  providerAnimeId?: number | null;
  episode: number;
  providerId?: string | null;
  audio?: StreamAudioType | null;
  expectedEpisodes?: number | null;
}): Promise<StreamSource | null> {
  const candidates = getTitleCandidates(input.animeTitle);
  const providersToTry = getProviderSearchOrder(input.providerId);
  const attemptedProviders: string[] = [];
  let primarySource: StreamSource | null = null;
  const fallbackSources: StreamFallbackSource[] = [];

  for (const provider of providersToTry) {
    attemptedProviders.push(provider.id);
    const source = await getSourceFromProvider({
      provider,
      candidates,
      providerAnimeId:
        provider.id === input.providerId || !input.providerId
          ? input.providerAnimeId
          : null,
      episode: input.episode,
      audio: input.audio,
      expectedEpisodes: input.expectedEpisodes,
    });

    if (!source?.embedUrl) {
      continue;
    }

    if (!primarySource) {
      primarySource = source;
      continue;
    }

    const fallbackSource = toFallbackSource(source);
    if (fallbackSource) {
      fallbackSources.push(fallbackSource);
    }
  }

  if (!primarySource) {
    return null;
  }

  return {
    ...primarySource,
    fallbacks: fallbackSources,
    attemptedProviders,
  };
}

export function getActiveStreamingProviderId(
  providerId?: string | null,
): string | null {
  return getProvider(providerId)?.id || null;
}

export function getStreamingProviderOptions(): StreamProviderOption[] {
  return providers.map((provider) => ({
    id: provider.id,
    label: provider.label,
    available: provider.isConfigured,
  }));
}

export function isStreamingConfigured(): boolean {
  return getConfiguredProviders().length > 0;
}

export function getStreamingProviderHealth(): ProviderHealth {
  const configuredProviders = getConfiguredProviders();
  const providerCount = configuredProviders.length;

  return {
    name: "Streaming",
    role: "streaming",
    status: providerCount > 0 ? "ready" : "disabled",
    notes:
      providerCount > 0
        ? `${providerCount} playback provider${
            providerCount === 1 ? "" : "s"
          } configured with ordered fallback.`
        : "No playback provider is configured. Set STREAMING_PROVIDERS or STREAMING_PROVIDER_URL.",
  };
}
