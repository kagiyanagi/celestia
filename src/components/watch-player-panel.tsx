"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, ListVideo, Play } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { StreamPlayer } from "@/components/stream-player";
import {
  type WatchAudioOption,
  WatchControls,
  type WatchServerOption,
} from "@/components/watch-controls";
import { useWatchSelection } from "@/components/watch-selection-context";
import { buildWatchHref } from "@/lib/watch-href";
import type {
  StreamAudioType,
  StreamProviderOption,
  StreamSource,
} from "@/types/streaming";

type EpisodeLink = {
  number: number;
  page: number;
};

type WatchPlayerPanelProps = {
  animeId: number;
  title: string;
  secondaryTitle: string | null;
  episode: number;
  page: number;
  order: "asc" | "desc";
  currentEpisodeTitle: string;
  previousEpisode: EpisodeLink | null;
  nextEpisode: EpisodeLink | null;
  providerOptions: StreamProviderOption[];
  streamingConfigured: boolean;
  initialSource: StreamSource | null;
};

const AUDIO_TRACKS: StreamAudioType[] = ["sub", "dub"];

export function WatchPlayerPanel({
  animeId,
  title,
  secondaryTitle,
  episode,
  page,
  order,
  currentEpisodeTitle,
  previousEpisode,
  nextEpisode,
  providerOptions,
  streamingConfigured,
  initialSource,
}: WatchPlayerPanelProps) {
  const selection = useWatchSelection();
  const [source, setSource] = useState<StreamSource | null>(initialSource);
  const [switching, setSwitching] = useState(false);
  // Guards against out-of-order responses when the viewer clicks several
  // servers quickly: only the most recent request is allowed to commit.
  const requestRef = useRef(0);

  const server = selection?.server ?? source?.providerId ?? null;
  const audio = selection?.audio ?? source?.audio ?? null;
  const sid = selection?.sid ?? source?.animeId ?? null;

  const activeServerLabel =
    providerOptions.find((provider) => provider.id === server)?.label ||
    source?.provider ||
    "Current server";

  const loadSource = useCallback(
    async (next: {
      server: string | null;
      audio: StreamAudioType | null;
      sid: number | null;
    }) => {
      const requestId = (requestRef.current += 1);
      setSwitching(true);

      const params = new URLSearchParams({ ep: String(episode) });
      if (next.server) params.set("server", next.server);
      if (next.audio) params.set("audio", next.audio);
      if (next.sid) params.set("sid", String(next.sid));

      try {
        const response = await fetch(
          `/api/watch/${animeId}/source?${params.toString()}`,
        );
        const data = (await response.json()) as {
          source?: StreamSource | null;
        };

        // A newer switch superseded this one — drop the stale result.
        if (requestRef.current !== requestId) {
          return;
        }

        const resolvedSource = data.source ?? null;
        setSource(resolvedSource);

        const resolved = {
          server: resolvedSource?.providerId ?? next.server,
          audio: resolvedSource?.audio ?? next.audio,
          sid: resolvedSource?.animeId ?? null,
        };
        selection?.setSelection(resolved);

        // Keep the URL shareable/refresh-safe without triggering a navigation
        // that would re-render the whole route.
        window.history.replaceState(
          null,
          "",
          buildWatchHref({
            animeId,
            episode,
            page,
            order,
            providerId: resolved.server,
            providerAnimeId: resolved.sid,
            audio: resolved.audio,
          }),
        );
      } catch {
        // Leave the current source in place; the player keeps playing.
      } finally {
        if (requestRef.current === requestId) {
          setSwitching(false);
        }
      }
    },
    [animeId, episode, order, page, selection],
  );

  function handleSelectServer(id: string) {
    if (id === server || switching) {
      return;
    }
    // The provider anime id is server-specific, so drop it when changing server.
    void loadSource({ server: id, audio, sid: null });
  }

  function handleSelectAudio(track: StreamAudioType) {
    if (track === audio || switching) {
      return;
    }
    void loadSource({ server, audio: track, sid });
  }

  const serverOptions: WatchServerOption[] = providerOptions.map((provider) => {
    const active = provider.id === server;

    return {
      id: provider.id,
      label: provider.label,
      active,
      available: active ? Boolean(source?.embedUrl) : provider.available,
      href: buildWatchHref({
        animeId,
        episode,
        page,
        order,
        providerId: provider.id,
        // The provider anime id is server-specific; only keep it for the
        // currently active server so the fallback navigation re-resolves.
        providerAnimeId: active ? sid : null,
        audio,
      }),
    };
  });

  const audioOptions: WatchAudioOption[] = AUDIO_TRACKS.map((track) => ({
    id: track,
    label: track === "sub" ? "Sub" : "Dub",
    active: audio === track,
    available: source?.availableAudio.includes(track) ?? false,
    href: buildWatchHref({
      animeId,
      episode,
      page,
      order,
      providerId: server,
      providerAnimeId: sid,
      audio: track,
    }),
  }));

  return (
    <>
      <section className="watch-player-stage">
        <div className="watch-player-top">
          <Link className="watch-back-link" href={`/anime/${animeId}`}>
            <ChevronLeft size={18} aria-hidden />
            Details
          </Link>
          <span className="watch-provider-badge">
            server - {activeServerLabel}
          </span>
        </div>

        <div className="watch-player-frame">
          {source?.embedUrl ? (
            <StreamPlayer
              primaryUrl={source.embedUrl}
              primaryReferrerPolicy={source.referrerPolicy}
              fallbacks={source.fallbacks || []}
              title={`${title} episode ${episode}`}
            />
          ) : (
            <div className="watch-player-empty">
              <Play size={44} aria-hidden />
              <h1>
                {streamingConfigured
                  ? "Episode source is not ready."
                  : "Streaming is not configured."}
              </h1>
              <p>
                {streamingConfigured
                  ? "Try another episode or switch servers when another provider is enabled."
                  : "Bring your own API here by setting the STREAMING_PROVIDER_URL environment variable."}
              </p>
            </div>
          )}

          {switching ? (
            <div
              className="watch-player-loading"
              role="status"
              aria-live="polite"
            >
              <span className="watch-player-spinner" aria-hidden />
              <span>Switching source…</span>
            </div>
          ) : null}
        </div>

        <div className="watch-now-playing">
          <div>
            <span className="section-kicker">
              <ListVideo size={16} aria-hidden />
              Episode {episode}
            </span>
            <h1>{currentEpisodeTitle}</h1>
            <p>
              {title}
              {secondaryTitle ? ` / ${secondaryTitle}` : ""}
            </p>
          </div>

          <div className="watch-episode-nav">
            {previousEpisode ? (
              <Link
                href={buildWatchHref({
                  animeId,
                  episode: previousEpisode.number,
                  page: previousEpisode.page,
                  order,
                  providerId: server,
                  providerAnimeId: sid,
                  audio,
                })}
              >
                <ChevronLeft size={16} aria-hidden />
                Previous
              </Link>
            ) : null}
            {nextEpisode ? (
              <Link
                href={buildWatchHref({
                  animeId,
                  episode: nextEpisode.number,
                  page: nextEpisode.page,
                  order,
                  providerId: server,
                  providerAnimeId: sid,
                  audio,
                })}
              >
                Next
                <ChevronRight size={16} aria-hidden />
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <WatchControls
        activeServerLabel={activeServerLabel}
        audioOptions={audioOptions}
        episode={episode}
        serverOptions={serverOptions}
        title={title}
        switching={switching}
        onSelectServer={handleSelectServer}
        onSelectAudio={handleSelectAudio}
      />
    </>
  );
}
