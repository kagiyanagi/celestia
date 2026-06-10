import {
  createStreamingAdapter,
  streamingAdapter,
  type StreamingAdapterConfig,
} from "@/lib/providers/streaming-adapter";
import { createEmbedAdapter } from "@/lib/providers/streaming-embed-adapter";
import {
  getStreamMapping,
  saveStreamMapping,
} from "@/lib/stream-mapping-store";
import type { ProviderHealth } from "@/types/anime";
import type {
  StreamAudioType,
  StreamAvailability,
  StreamFallbackSource,
  StreamingProvider,
  StreamProviderOption,
  StreamReferrerPolicy,
  StreamSource,
} from "@/types/streaming";

const REFERRER_POLICIES: StreamReferrerPolicy[] = [
  "no-referrer",
  "origin",
  "origin-when-cross-origin",
  "strict-origin-when-cross-origin",
  "unsafe-url",
];

function toReferrerPolicy(value: unknown): StreamReferrerPolicy | undefined {
  return typeof value === "string" &&
    (REFERRER_POLICIES as string[]).includes(value)
    ? (value as StreamReferrerPolicy)
    : undefined;
}

const LEGACY_PROVIDER_ID = process.env.STREAMING_PROVIDER_ID || "custom";

type RawStreamingProviderConfig = {
  id?: unknown;
  label?: unknown;
  url?: unknown;
  priority?: unknown;
  kind?: unknown;
  referrerPolicy?: unknown;
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
    kind: value.kind === "embed" ? "embed" : "search",
    referrerPolicy: toReferrerPolicy(value.referrerPolicy),
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
      kind:
        process.env.STREAMING_PROVIDER_KIND === "embed" ? "embed" : "search",
      referrerPolicy: toReferrerPolicy(
        process.env.STREAMING_PROVIDER_REFERRER_POLICY,
      ),
    },
  ];
}

function createProvider(config: StreamingAdapterConfig): StreamingProvider {
  if (config.kind === "embed") {
    return createEmbedAdapter(config);
  }

  // Reuse the prebuilt singleton when it matches the single-provider env vars.
  return config.id === streamingAdapter.id &&
    config.url === process.env.STREAMING_PROVIDER_URL
    ? streamingAdapter
    : createStreamingAdapter(config);
}

const providers = getProviderConfigs()
  .map(createProvider)
  .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));

function getRejectionThreshold(expectedEps: number): number {
  // Short formats (movies, OVAs) must match almost exactly; longer shows get
  // some slack for specials/recaps counted differently across providers.
  if (expectedEps <= 3) {
    return 2;
  }

  return Math.max(6, Math.round(expectedEps * 0.5));
}

/**
 * Scores how well a provider search result lines up with the catalog entry.
 *
 * Scoring works on two axes:
 *   - Candidate index: the first title variant tried scores higher; later
 *     variants are penalized because they are less likely to be the right match.
 *   - Provider priority: lower-priority providers (higher `priority` values)
 *     are slightly penalized so a well-matched primary server beats a
 *     well-matched backup.
 *
 * Episode count comparison:
 *   - Exact match: large bonus (+50). This is the happy path.
 *   - Off by ≤2: small bonus (+20), accommodates providers that count specials
 *     differently from AniList.
 *   - Off beyond the rejection threshold: return null — this is almost
 *     certainly a different entry (wrong season, whole-franchise listing).
 *     A wrong stream is considered worse than no stream.
 *   - Anything else: heavy penalty (-80), keeps it from winning over a
 *     count-verified match on another server.
 *
 * Returns null when the episode counts are irreconcilable.
 */
function calculateAlignmentScore(
  expectedEps: number | null,
  foundEps: number | null,
  candidateIndex: number,
  providerPriority: number,
): number | null {
  let score = 100 - candidateIndex * 10 - Math.max(0, providerPriority - 100);

  if (expectedEps && foundEps) {
    const diff = Math.abs(expectedEps - foundEps);
    if (diff === 0) {
      score += 50;
    } else if (diff <= 2) {
      score += 20;
    } else if (diff > getRejectionThreshold(expectedEps)) {
      return null;
    } else {
      score -= 80;
    }
  }

  return score;
}

function isVerifiedMatch(
  availability: StreamAvailability,
  expectedEpisodes: number | null,
): boolean {
  return Boolean(
    availability.providerAnimeId &&
      expectedEpisodes &&
      availability.episodeCount &&
      Math.abs(expectedEpisodes - availability.episodeCount) <= 2,
  );
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

/**
 * Builds the list of title variants to probe against the streaming provider.
 *
 * Providers typically index anime by their own display title, which may differ
 * from AniList's canonical title in several predictable ways: format suffixes
 * ("(TV)", "(OVA)"), season number style ("Season 2" vs "S2" vs just "2"),
 * ordinal seasons ("2nd Season"), Part variants, colon-separated subtitles,
 * article stripping ("The", "A"), and CJK-to-alphanumeric normalization.
 *
 * Each variant costs one provider request, so the list is capped at 16.
 * The strongest candidate (the original AniList title) is always tried first
 * so the common exact-match case only costs one request.
 *
 * Blank candidates (possible when a CJK-only title normalizes to "") are
 * dropped before the cap is applied — an empty string would 404 immediately.
 */
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

  // Each candidate costs one provider request, so cap the probe list.
  // Original titles come first, so the most likely matches are kept. Drop
  // blanks — a CJK-only title can normalize to "" and would otherwise probe
  // the provider with an empty query (a guaranteed 404).
  return Array.from(new Set(candidates))
    .filter((candidate) => candidate.trim().length > 0)
    .slice(0, 16);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );

  return results;
}

async function findProviderAvailability(input: {
  provider: StreamingProvider;
  candidates: string[];
  expectedEpisodes: number | null;
  anilistId?: number | null;
}): Promise<StreamAvailability | null> {
  // AniList-id-keyed embed providers resolve deterministically from the id —
  // no title guessing, no episode-count verification, no mapping to persist.
  // Without an id there is nothing to key on.
  if (input.provider.keysByAnilistId) {
    if (!input.anilistId) {
      return null;
    }

    return input.provider.findAvailability("", input.anilistId);
  }

  // A previously verified mapping skips title guessing entirely.
  if (input.anilistId) {
    const stored = await getStreamMapping(input.anilistId, input.provider.id);

    if (stored) {
      return {
        available: true,
        providerId: input.provider.id,
        provider: input.provider.label,
        providerAnimeId: stored.providerAnimeId,
        episodeCount: stored.episodeCount,
        score: stored.score,
      };
    }
  }

  const checkCandidate = async (
    candidate: string,
    index: number,
  ): Promise<StreamAvailability | null> => {
    const availability = await input.provider.findAvailability(candidate);

    if (availability.available) {
      const score = calculateAlignmentScore(
        input.expectedEpisodes,
        availability.episodeCount,
        index,
        input.provider.priority,
      );

      // null score = episode counts irreconcilable; not the same entry.
      if (score === null) {
        return null;
      }

      availability.score = score;
      return availability;
    }

    return null;
  };

  // Try the strongest title first so the common exact-match case stays one
  // provider request. If that is not decisive, probe the remaining candidates
  // with bounded concurrency instead of serially waiting up to 15 more times.
  const first = input.candidates[0]
    ? await checkCandidate(input.candidates[0], 0)
    : null;
  const results: StreamAvailability[] = first ? [first] : [];

  if ((first?.score || 0) < 140 && input.candidates.length > 1) {
    const rest = await mapWithConcurrency(
      input.candidates.slice(1),
      4,
      (candidate, index) => checkCandidate(candidate, index + 1),
    );
    results.push(
      ...rest.filter((item): item is StreamAvailability => Boolean(item)),
    );
  }

  const best =
    results.sort((a, b) => (b.score || 0) - (a.score || 0))[0] || null;

  // A wrong stream is worse than no stream. When we know the expected episode
  // count, only serve a count-verified match (the same bar we persist at) — a
  // title-guessed candidate whose count merely "isn't bad enough to reject" is
  // refused. Without an expected count we can't verify, so the best-scored
  // candidate stands.
  if (
    best &&
    input.expectedEpisodes &&
    !isVerifiedMatch(best, input.expectedEpisodes)
  ) {
    return null;
  }

  // Persist only episode-count-verified matches so a weak guess never gets
  // locked in.
  if (
    best?.providerAnimeId &&
    input.anilistId &&
    isVerifiedMatch(best, input.expectedEpisodes)
  ) {
    await saveStreamMapping({
      anilistId: input.anilistId,
      providerId: input.provider.id,
      providerAnimeId: best.providerAnimeId,
      episodeCount: best.episodeCount,
      score: best.score || 0,
    });
  }

  return best;
}

export async function findStreamAvailability(
  title: string | string[],
  expectedEpisodes: number | null = null,
  providerId?: string | null,
  anilistId?: number | null,
): Promise<StreamAvailability> {
  const candidates = getTitleCandidates(title);
  const providersToTry = getProviderSearchOrder(providerId);
  const results: StreamAvailability[] = [];

  for (const provider of providersToTry) {
    const availability = await findProviderAvailability({
      provider,
      candidates,
      expectedEpisodes,
      anilistId,
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
  anilistId?: number | null;
}): Promise<StreamSource | null> {
  const providerAnimeId =
    input.providerAnimeId ||
    (
      await findProviderAvailability({
        provider: input.provider,
        candidates: input.candidates,
        expectedEpisodes: input.expectedEpisodes ?? null,
        anilistId: input.anilistId,
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
    anilistId: input.anilistId,
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
    referrerPolicy: source.referrerPolicy,
  };
}

export async function getStreamSource(input: {
  animeTitle: string | string[];
  providerAnimeId?: number | null;
  episode: number;
  providerId?: string | null;
  audio?: StreamAudioType | null;
  expectedEpisodes?: number | null;
  anilistId?: number | null;
}): Promise<StreamSource | null> {
  const candidates = getTitleCandidates(input.animeTitle);
  const providersToTry = getProviderSearchOrder(input.providerId);
  const attemptedProviders = providersToTry.map((provider) => provider.id);
  const fallbackSources: StreamFallbackSource[] = [];

  const sources = await Promise.all(
    providersToTry.map((provider) =>
      getSourceFromProvider({
        provider,
        candidates,
        providerAnimeId:
          provider.id === input.providerId || !input.providerId
            ? input.providerAnimeId
            : null,
        episode: input.episode,
        audio: input.audio,
        expectedEpisodes: input.expectedEpisodes,
        anilistId: input.anilistId,
      }).catch(() => null),
    ),
  );

  let primarySource: StreamSource | null = null;
  for (const source of sources) {
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
