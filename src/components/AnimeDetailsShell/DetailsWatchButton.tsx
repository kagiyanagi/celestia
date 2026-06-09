"use client";

import Link from "next/link";
import { Play } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getResumeEpisode } from "@/lib/resume";
import { buildWatchHref } from "@/lib/watch-href";
import type { AnimeDetails } from "@/types/anime";

interface DetailsWatchButtonProps {
  anime: AnimeDetails;
  watchHref: string;
}

export function DetailsWatchButton({ anime, watchHref }: DetailsWatchButtonProps) {
  const { user } = useAuth();

  if (anime.status === "NOT_YET_RELEASED") {
    return (
      <div className="hero-watch-btn disabled">
        <Play size={18} fill="currentColor" />
        Not Yet Released
      </div>
    );
  }

  // Most-recent history row for this title drives "continue where you left off".
  const lastWatched = (user?.historyEntries ?? [])
    .filter((entry) => entry.animeId === anime.id)
    .sort((a, b) => b.watchedAt.localeCompare(a.watchedAt))[0];

  const resumeEpisode = lastWatched ? getResumeEpisode(lastWatched) : null;
  const href =
    resumeEpisode && resumeEpisode > 1
      ? buildWatchHref({ animeId: anime.id, episode: resumeEpisode })
      : watchHref;

  return (
    <Link className="hero-watch-btn" href={href}>
      <Play size={18} fill="currentColor" />
      {resumeEpisode && resumeEpisode > 1
        ? `Continue Ep ${resumeEpisode}`
        : "Watch Now"}
    </Link>
  );
}
