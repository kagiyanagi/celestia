"use client";

import { useEffect } from "react";
import type { AnimeSummary } from "@/types/anime";

export function WatchHistoryRecorder({
  anime,
  episode,
  episodeTitle,
  durationLabel,
}: {
  anime: AnimeSummary;
  episode: number;
  episodeTitle: string;
  durationLabel: string | null;
}) {
  useEffect(() => {
    void fetch("/api/history", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        anime,
        episode,
        episodeTitle,
        durationLabel,
        progressPercent: 100,
      }),
    }).catch(() => undefined);
  }, [anime, durationLabel, episode, episodeTitle]);

  return null;
}
