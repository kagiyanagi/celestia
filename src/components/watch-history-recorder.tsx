"use client";

import { useEffect } from "react";
import type { AnimeSummary } from "@/types/anime";

const TICK_MS = 5_000;
const POST_EVERY_TICKS = 6; // sync progress every 30s

/**
 * Records watch history with a time-based progress estimate. The stream
 * player is a cross-origin embed, so true playback position is unreadable —
 * progress is measured as time spent on the episode while the tab is
 * visible, against the episode runtime.
 */
export function WatchHistoryRecorder({
  anime,
  episode,
  episodeTitle,
  episodeImage,
  durationLabel,
  durationMinutes,
}: {
  anime: AnimeSummary;
  episode: number;
  episodeTitle: string;
  episodeImage: string | null;
  durationLabel: string | null;
  durationMinutes: number | null;
}) {
  useEffect(() => {
    const durationSeconds = durationMinutes ? durationMinutes * 60 : null;
    let watchedSeconds = 0;
    let lastSentPercent = -1;
    let cancelled = false;

    function currentPercent(): number {
      if (!durationSeconds) {
        return 0;
      }

      return Math.min(100, Math.round((watchedSeconds / durationSeconds) * 100));
    }

    function send(progressOnly: boolean, keepalive = false) {
      const progressPercent = currentPercent();

      if (progressOnly && progressPercent === lastSentPercent) {
        return;
      }

      lastSentPercent = progressPercent;
      void fetch("/api/history", {
        method: "POST",
        keepalive,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          anime,
          episode,
          episodeTitle,
          episodeImage,
          durationLabel,
          progressPercent,
          progressOnly,
        }),
      }).catch(() => undefined);
    }

    // Initial record: creates the history entry and bumps library/AniList once.
    send(false);

    let ticks = 0;
    const interval = window.setInterval(() => {
      if (cancelled || document.visibilityState !== "visible") {
        return;
      }

      watchedSeconds += TICK_MS / 1000;
      ticks += 1;

      if (ticks % POST_EVERY_TICKS === 0) {
        send(true);
      }
    }, TICK_MS);

    const flush = () => send(true, true);
    window.addEventListener("pagehide", flush);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("pagehide", flush);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anime.id, episode]);

  return null;
}
