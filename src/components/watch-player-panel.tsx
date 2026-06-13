"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  ListVideo,
  Maximize2,
  Play,
  RefreshCw,
  Tv,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { LibraryEntryDialog } from "@/components/library-entry-dialog";
import { LibraryStatusChip } from "@/components/library-status-chip";
import { StreamPlayer } from "@/components/stream-player";
import {
  type WatchAudioOption,
  WatchControls,
  type WatchServerOption,
} from "@/components/watch-controls";
import { useWatchSelection } from "@/components/watch-selection-context";
import { buildWatchHref } from "@/lib/watch-href";
import type { AnimeSummary } from "@/types/anime";
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
  // Tracking inputs so "Mark watched" / list controls can write history without
  // a round-trip back to the server-rendered page.
  trackingAnime: AnimeSummary;
  episodeTitle: string;
  episodeImage: string | null;
  durationLabel: string | null;
  totalEpisodes: number;
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
  trackingAnime,
  episodeTitle,
  episodeImage,
  durationLabel,
  totalEpisodes,
}: WatchPlayerPanelProps) {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const selection = useWatchSelection();
  const [source, setSource] = useState<StreamSource | null>(initialSource);
  const [switching, setSwitching] = useState(false);
  const [theater, setTheater] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  // Guards against out-of-order responses when the viewer clicks several
  // servers quickly: only the most recent request is allowed to commit.
  const requestRef = useRef(0);
  const frameRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<number | undefined>(undefined);

  const server = selection?.server ?? source?.providerId ?? null;
  const audio = selection?.audio ?? source?.audio ?? null;
  const sid = selection?.sid ?? source?.animeId ?? null;

  const activeServerLabel =
    providerOptions.find((provider) => provider.id === server)?.label ||
    source?.provider ||
    "Current server";

  const libraryEntry =
    user?.libraryEntries.find((entry) => entry.animeId === animeId) || null;
  const watchedEpisodes = useMemo(
    () =>
      new Set(
        (user?.historyEntries || [])
          .filter((entry) => entry.animeId === animeId)
          .map((entry) => entry.episode),
      ),
    [user, animeId],
  );
  const watchedCount = Math.max(watchedEpisodes.size, libraryEntry?.progress ?? 0);
  const currentWatched = watchedEpisodes.has(episode) || episode <= (libraryEntry?.progress ?? 0);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimerRef.current), []);

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

        // A newer switch superseded this one - drop the stale result.
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

        // Remember the chosen server so the next visit defaults to it (read by
        // the page as a fallback when the URL carries no explicit server).
        if (resolved.server) {
          document.cookie = `mirucast_server=${resolved.server}; path=/; max-age=31536000; samesite=lax`;
        }

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

  const handleSelectServer = useCallback(
    (id: string) => {
      if (id === server || switching) {
        return;
      }
      // The provider anime id is server-specific, so drop it when changing server.
      void loadSource({ server: id, audio, sid: null });
    },
    [server, switching, loadSource, audio],
  );

  function handleSelectAudio(track: StreamAudioType) {
    if (track === audio || switching) {
      return;
    }
    void loadSource({ server, audio: track, sid });
  }

  function tryAnotherServer() {
    const next =
      providerOptions.find((option) => option.id !== server) ||
      providerOptions[0];
    if (next) {
      handleSelectServer(next.id);
    }
  }

  const toggleFullscreen = useCallback(() => {
    const node = frameRef.current;
    if (!node) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void node.requestFullscreen?.();
    }
  }, []);

  const nextHref = nextEpisode
    ? buildWatchHref({
        animeId,
        episode: nextEpisode.number,
        page: nextEpisode.page,
        order,
        providerId: server,
        providerAnimeId: sid,
        audio,
      })
    : null;
  const previousHref = previousEpisode
    ? buildWatchHref({
        animeId,
        episode: previousEpisode.number,
        page: previousEpisode.page,
        order,
        providerId: server,
        providerAnimeId: sid,
        audio,
      })
    : null;

  // Theater mode dims the rest of the page; clean the class up on unmount too.
  useEffect(() => {
    document.body.classList.toggle("watch-theater-active", theater);
    return () => document.body.classList.remove("watch-theater-active");
  }, [theater]);

  // Keyboard shortcuts: N/P episode nav, F fullscreen, T theater.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      switch (event.key.toLowerCase()) {
        case "n":
          if (nextHref) {
            event.preventDefault();
            router.push(nextHref);
          }
          break;
        case "p":
          if (previousHref) {
            event.preventDefault();
            router.push(previousHref);
          }
          break;
        case "f":
          event.preventDefault();
          toggleFullscreen();
          break;
        case "t":
          event.preventDefault();
          setTheater((value) => !value);
          break;
        case "escape":
          setTheater(false);
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nextHref, previousHref, router, toggleFullscreen]);

  // Warm the next episode's source in the provider cache so Next is snappy.
  const prefetchedRef = useRef(false);
  useEffect(() => {
    if (prefetchedRef.current || !nextEpisode || !source?.embedUrl) return;
    prefetchedRef.current = true;
    const params = new URLSearchParams({ ep: String(nextEpisode.number) });
    if (server) params.set("server", server);
    if (audio) params.set("audio", audio);
    const timer = window.setTimeout(() => {
      void fetch(`/api/watch/${animeId}/source?${params.toString()}`).catch(
        () => undefined,
      );
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [animeId, nextEpisode, server, audio, source?.embedUrl]);

  async function markWatched() {
    if (marking) return;
    setMarking(true);
    try {
      await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anime: trackingAnime,
          episode,
          episodeTitle,
          episodeImage,
          durationLabel,
          progressPercent: 100,
          progressOnly: false,
        }),
      });
      await refreshUser();
      showToast(`Marked episode ${episode} as watched`);
    } catch {
      showToast("Couldn't update progress");
    } finally {
      setMarking(false);
    }
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
          <div className="watch-player-top-actions">
            <span className="watch-provider-badge">
              server - {activeServerLabel}
            </span>
            <button
              type="button"
              className={
                theater ? "watch-icon-toggle active" : "watch-icon-toggle"
              }
              onClick={() => setTheater((value) => !value)}
              aria-pressed={theater}
              title="Theater mode (T)"
            >
              <Tv size={16} aria-hidden />
            </button>
            <button
              type="button"
              className="watch-icon-toggle"
              onClick={toggleFullscreen}
              title="Fullscreen (F)"
            >
              <Maximize2 size={16} aria-hidden />
            </button>
          </div>
        </div>

        <div className="watch-player-frame" ref={frameRef}>
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
                  ? "This server didn't have the episode. Try another server below."
                  : "Bring your own API here by setting the STREAMING_PROVIDER_URL environment variable."}
              </p>
              {streamingConfigured && providerOptions.length > 1 ? (
                <button
                  type="button"
                  className="watch-empty-action"
                  onClick={tryAnotherServer}
                  disabled={switching}
                >
                  <RefreshCw size={16} aria-hidden />
                  Try another server
                </button>
              ) : null}
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
          <div className="watch-now-info">
            <span className="section-kicker">
              <ListVideo size={16} aria-hidden />
              Episode {episode}
              {totalEpisodes ? ` of ${totalEpisodes}` : ""}
            </span>
            <h1>{currentEpisodeTitle}</h1>
            <p>
              {title}
              {secondaryTitle ? ` / ${secondaryTitle}` : ""}
            </p>
            {watchedCount > 0 && totalEpisodes ? (
              <span className="watch-progress-line">
                {watchedCount} of {totalEpisodes} watched
              </span>
            ) : null}
          </div>

          <div className="watch-now-side">
            <div className="watch-now-actions">
              <button
                type="button"
                className={
                  currentWatched
                    ? "watch-track-button active"
                    : "watch-track-button"
                }
                onClick={markWatched}
                disabled={marking || currentWatched}
                title={
                  currentWatched
                    ? "You've marked this episode watched"
                    : "Mark this episode as watched"
                }
              >
                <Check size={16} aria-hidden />
                {currentWatched ? "Watched" : marking ? "Saving…" : "Mark watched"}
              </button>
              <button
                type="button"
                className="watch-track-button"
                onClick={() => setLibraryOpen(true)}
              >
                <Bookmark size={16} aria-hidden />
                {libraryEntry ? (
                  <LibraryStatusChip status={libraryEntry.status} inline />
                ) : (
                  "Add to list"
                )}
              </button>
            </div>

            <div className="watch-episode-nav">
              {previousHref ? (
                <Link href={previousHref}>
                  <ChevronLeft size={16} aria-hidden />
                  Previous
                </Link>
              ) : null}
              {nextHref ? (
                <Link href={nextHref}>
                  Next
                  <ChevronRight size={16} aria-hidden />
                </Link>
              ) : null}
            </div>
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
        onShareResult={showToast}
      />

      {libraryOpen ? (
        <LibraryEntryDialog
          anime={trackingAnime}
          onClose={() => setLibraryOpen(false)}
        />
      ) : null}

      {toast ? (
        <div className="watch-toast" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}

      {theater ? (
        <div
          className="watch-theater-backdrop"
          aria-hidden
          onClick={() => setTheater(false)}
        />
      ) : null}
    </>
  );
}
