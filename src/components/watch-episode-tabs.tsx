"use client";

import {
  CalendarClock,
  Info,
  ListVideo,
  MessageSquare,
  Star,
  Tag,
} from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/components/auth-provider";
import {
  EpisodeBrowser,
  type BrowserEpisode,
  type EpisodeBrowserAnime,
} from "@/components/episode-browser";
import { LibraryStatusChip } from "@/components/library-status-chip";
import { formatIsoDate, formatIsoDateTime } from "@/lib/format";
import type { AnimeSummary } from "@/types/anime";
import { AnimeCommunityComments } from "@/components/anime-community-comments";

type WatchTabKey = "overview" | "episodes" | "comments";

const COMMENTS_ENABLED = true;

/** The current episode's own metadata, surfaced in the Overview tab. */
export type WatchEpisodeOverview = {
  number: number;
  title: string;
  description: string | null;
  rating: number | null;
  airDate: string | null;
  airDateTime: string | null;
};

const TABS: { key: WatchTabKey; label: string; icon: typeof ListVideo }[] = [
  { key: "overview", label: "Overview", icon: Info },
  { key: "episodes", label: "Episodes", icon: ListVideo },
  ...(COMMENTS_ENABLED
    ? [{ key: "comments" as const, label: "Comments", icon: MessageSquare }]
    : []),
];

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function EpisodeOverview({
  episode,
  show,
}: {
  episode: WatchEpisodeOverview;
  show: AnimeSummary;
}) {
  const { user } = useAuth();
  const released =
    formatIsoDateTime(episode.airDateTime) || formatIsoDate(episode.airDate);
  const entry =
    user?.libraryEntries.find((item) => item.animeId === show.id) || null;
  const showSynopsis = show.description ? stripHtml(show.description) : null;
  const studioNames = (show.studios || [])
    .map((studio) => studio.name)
    .filter((name): name is string => Boolean(name))
    .slice(0, 2);

  return (
    <div className="watch-ep-overview">
      <div className="watch-ep-overview-head">
        <span className="section-kicker">
          <ListVideo size={16} aria-hidden />
          Episode {episode.number}
        </span>
        <h2>{episode.title}</h2>
      </div>

      <div className="watch-ep-stat-grid">
        <div className="watch-ep-stat">
          <span className="watch-ep-stat-label">
            <Star size={14} aria-hidden />
            Episode rating
          </span>
          <strong className="watch-ep-stat-value">
            {episode.rating != null ? episode.rating.toFixed(1) : "Unrated"}
            {episode.rating != null ? <small> / 10</small> : null}
          </strong>
        </div>
        <div className="watch-ep-stat">
          <span className="watch-ep-stat-label">
            <CalendarClock size={14} aria-hidden />
            Released
          </span>
          <strong className="watch-ep-stat-value" suppressHydrationWarning>
            {released || "Unknown"}
          </strong>
        </div>
      </div>

      <div className="watch-ep-synopsis">
        <h3>Synopsis</h3>
        <p>
          {episode.description ||
            "No synopsis has been published for this episode yet."}
        </p>
      </div>

      <div className="watch-ep-show">
        <h3>About this anime</h3>
        <div className="watch-ep-show-meta">
          {show.averageScore ? (
            <span className="watch-ep-show-pill">
              <Star size={13} aria-hidden />
              {(show.averageScore / 10).toFixed(1)} / 10
            </span>
          ) : null}
          {studioNames.length > 0 ? (
            <span className="watch-ep-show-pill">{studioNames.join(", ")}</span>
          ) : null}
          {entry ? <LibraryStatusChip status={entry.status} inline /> : null}
          {entry && entry.score > 0 ? (
            <span className="watch-ep-show-pill">
              Your score {(entry.score / 10).toFixed(1)}
            </span>
          ) : null}
        </div>
        {show.genres && show.genres.length > 0 ? (
          <div className="watch-ep-genres">
            <Tag size={13} aria-hidden />
            {show.genres.slice(0, 6).map((genre) => (
              <span key={genre} className="watch-ep-genre-chip">
                {genre}
              </span>
            ))}
          </div>
        ) : null}
        {showSynopsis ? (
          <p className="watch-ep-show-synopsis">{showSynopsis}</p>
        ) : null}
      </div>
    </div>
  );
}

function WatchComments({
  aniListId,
  malId,
  episodeNumber,
}: {
  aniListId: number;
  malId?: number | null;
  episodeNumber: number;
}) {
  return (
    <div className="watch-ep-comments">
      <AnimeCommunityComments
        aniListId={aniListId}
        malId={malId}
        episodeNumber={episodeNumber}
      />
    </div>
  );
}

export function WatchEpisodeTabs({
  anime,
  episodes,
  activeEpisode,
  currentEpisode,
  trackingAnime,
}: {
  anime: EpisodeBrowserAnime;
  episodes: BrowserEpisode[];
  activeEpisode: number;
  currentEpisode: WatchEpisodeOverview;
  trackingAnime: AnimeSummary;
}) {
  const [tab, setTab] = useState<WatchTabKey>("overview");

  return (
    <div className="watch-ep-tabs">
      <nav className="watch-ep-tabs-nav">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            <Icon size={16} aria-hidden />
            {label}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <EpisodeOverview episode={currentEpisode} show={trackingAnime} />
      ) : null}
      {tab === "episodes" ? (
        <EpisodeBrowser
          anime={anime}
          episodes={episodes}
          activeEpisode={activeEpisode}
          trackingAnime={trackingAnime}
        />
      ) : null}
      {tab === "comments" && COMMENTS_ENABLED ? (
        <WatchComments
          aniListId={trackingAnime.id}
          malId={trackingAnime.idMal}
          episodeNumber={activeEpisode}
        />
      ) : null}
    </div>
  );
}
