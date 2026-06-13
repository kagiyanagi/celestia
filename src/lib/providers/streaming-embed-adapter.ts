import type { StreamingAdapterConfig } from "@/lib/providers/streaming-adapter";
import type {
  StreamAudioType,
  StreamAvailability,
  StreamingProvider,
  StreamSource,
} from "@/types/streaming";

// Generic embed provider. Instead of searching by title, it resolves playback
// deterministically by substituting the AniList id, episode number, and audio
// track into a URL template the deployer supplies via configuration:
//
//   url = "https://<your-host>/<your-path>/{id}/{episode}/{audio}"
//
// The template - and the endpoint it points at - live entirely in the
// deployer's own environment; nothing is hardcoded here. As long as the
// template resolves to a genuinely iframe-able player page (not a raw stream),
// it stays within the iframe-only, no-proxy streaming boundary. Because it is
// keyed by the exact AniList id there is no wrong-season risk, so it skips the
// title-guessing and episode-count verification the search adapter relies on
// (see streaming.ts). It exposes no episode list or count - the watch page
// falls back to AniList metadata for those.

const AUDIO_OPTIONS: StreamAudioType[] = ["sub", "dub"];

function clampEpisode(episode: number): number {
  if (!Number.isFinite(episode)) {
    return 1;
  }

  return Math.max(1, Math.floor(episode));
}

function fillTemplate(
  template: string,
  values: { id: number; episode: number; audio: StreamAudioType },
): string {
  return template
    .replace(/\{id\}/gi, String(values.id))
    .replace(/\{episode\}/gi, String(values.episode))
    .replace(/\{audio\}/gi, values.audio);
}

export function createEmbedAdapter(
  config: StreamingAdapterConfig,
): StreamingProvider {
  const template = config.url.trim();
  const isConfigured = Boolean(template);
  const priority = config.priority ?? 150;

  async function findAvailability(
    _title: string,
    anilistId?: number | null,
  ): Promise<StreamAvailability> {
    // No search/verification endpoint exists: an embed URL can be built for any
    // AniList id. Availability simply mirrors whether we have an id to key on.
    return {
      available: Boolean(isConfigured && anilistId),
      providerId: config.id,
      provider: config.label,
      providerAnimeId: anilistId ?? null,
      // Episode count is genuinely unknown here; never fabricate one.
      episodeCount: null,
      // Below the >=140 short-circuit so a count-verified search match still
      // wins when both resolve, but high enough to lead other fallbacks.
      score: 120,
    };
  }

  async function getSource(input: {
    animeTitle: string;
    providerAnimeId?: number | null;
    episode: number;
    audio?: StreamAudioType | null;
    expectedEpisodes?: number | null;
    anilistId?: number | null;
  }): Promise<StreamSource | null> {
    // The AniList id is the only correct key; prefer it over any provider id
    // carried in from a stale URL param.
    const anilistId = input.anilistId ?? input.providerAnimeId ?? null;

    if (!isConfigured || !anilistId) {
      return null;
    }

    const episode = clampEpisode(input.episode);
    const audio: StreamAudioType = input.audio || "sub";
    const embedUrl = fillTemplate(template, { id: anilistId, episode, audio });

    return {
      providerId: config.id,
      provider: config.label,
      animeId: anilistId,
      episode,
      audio,
      // Both audio tracks are valid substitutions; whether a dub actually
      // exists is decided upstream.
      availableAudio: AUDIO_OPTIONS,
      embedUrl,
      // Some embed hosts only resolve when the iframe sends a Referer; pass the
      // configured policy through (undefined => the player's no-referrer default).
      referrerPolicy: config.referrerPolicy,
      // No episode catalog from this provider - the watch page uses AniList
      // metadata for the episode list.
      episodes: [],
    };
  }

  return {
    id: config.id,
    label: config.label,
    priority,
    isConfigured,
    keysByAnilistId: true,
    findAvailability,
    getSource,
  };
}
