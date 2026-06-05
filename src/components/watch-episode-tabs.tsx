"use client";

import {
  CalendarClock,
  Info,
  ListVideo,
  MessageSquare,
  Star,
} from "lucide-react";
import { useState } from "react";

import {
  EpisodeBrowser,
  type BrowserEpisode,
  type EpisodeBrowserAnime,
} from "@/components/episode-browser";
import { formatIsoDate, formatIsoDateTime } from "@/lib/format";

type WatchTabKey = "overview" | "episodes" | "comments";

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
  { key: "comments", label: "Comments", icon: MessageSquare },
];

// Placeholder thread shown until real comments are wired up. Intentionally
// inert — see WatchComments below.
const SAMPLE_COMMENTS: {
  id: number;
  author: string;
  when: string;
  body: string;
}[] = [
  {
    id: 1,
    author: "celestia",
    when: "2 hours ago",
    body: "Comments aren't live yet — this is a preview of how the thread will look once they ship.",
  },
  {
    id: 2,
    author: "viewer_42",
    when: "5 hours ago",
    body: "That mid-episode turn was unreal. Easily one of the strongest cliffhangers this season.",
  },
  {
    id: 3,
    author: "sakura_n",
    when: "yesterday",
    body: "The animation in the second half went absurdly hard. Replaying it a few times already.",
  },
];

function EpisodeOverview({ episode }: { episode: WatchEpisodeOverview }) {
  const released =
    formatIsoDateTime(episode.airDateTime) || formatIsoDate(episode.airDate);

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
    </div>
  );
}

function WatchComments() {
  return (
    <div className="watch-ep-comments">
      <div className="watch-ep-comments-note">
        <MessageSquare size={16} aria-hidden />
        Comments are coming soon — this is a preview and isn&apos;t live yet.
      </div>

      <form
        className="watch-ep-comment-form"
        // Dummy UI only — nothing is submitted.
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="watch-ep-comment-avatar" aria-hidden />
        <textarea
          className="watch-ep-comment-input"
          placeholder="Add a comment…"
          rows={3}
          disabled
        />
        <button type="submit" className="watch-ep-comment-submit" disabled>
          Post
        </button>
      </form>

      <ul className="watch-ep-comment-list">
        {SAMPLE_COMMENTS.map((comment) => (
          <li key={comment.id} className="watch-ep-comment">
            <div className="watch-ep-comment-avatar" aria-hidden>
              {comment.author.charAt(0).toUpperCase()}
            </div>
            <div className="watch-ep-comment-body">
              <div className="watch-ep-comment-meta">
                <strong>{comment.author}</strong>
                <span>{comment.when}</span>
              </div>
              <p>{comment.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WatchEpisodeTabs({
  anime,
  episodes,
  activeEpisode,
  currentEpisode,
}: {
  anime: EpisodeBrowserAnime;
  episodes: BrowserEpisode[];
  activeEpisode: number;
  currentEpisode: WatchEpisodeOverview;
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

      {tab === "overview" ? <EpisodeOverview episode={currentEpisode} /> : null}
      {tab === "episodes" ? (
        <EpisodeBrowser
          anime={anime}
          episodes={episodes}
          activeEpisode={activeEpisode}
        />
      ) : null}
      {tab === "comments" ? <WatchComments /> : null}
    </div>
  );
}
