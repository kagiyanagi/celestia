"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  RotateCcw,
  ArrowDown01,
  ArrowDown10,
  Search,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { EpisodeThumbnail } from "@/components/episode-thumbnail";
import { formatIsoDate } from "@/lib/format";
import type { AnimeDetails } from "@/types/anime";

const EP_PER_PAGE = 47;

export type BrowserEpisode = {
  number: number;
  title: string | null;
  description: string | null;
  thumbnail: string | null;
  /** ISO release date; null when the provider doesn't know it. */
  airDate?: string | null;
  /** 10-point community rating; null when unknown. */
  rating?: number | null;
};

export type EpisodeWatchQuery = {
  sid?: string | null;
  server?: string | null;
  audio?: string | null;
};

type EpisodeBrowserAnime = Pick<
  AnimeDetails,
  "id" | "bannerImage" | "coverImage" | "dubInfo" | "episodeFlags"
>;

/**
 * Shared episode list (details Episodes tab + watch page): search by
 * number/title/description, pagination, sort order, watched dimming with
 * progress, dub availability, and filler/recap tags.
 */
export function EpisodeBrowser({
  anime,
  episodes,
  watchQuery,
  activeEpisode = null,
}: {
  anime: EpisodeBrowserAnime;
  episodes: BrowserEpisode[];
  watchQuery?: EpisodeWatchQuery;
  activeEpisode?: number | null;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [epPage, setEpPage] = useState(() => {
    const index = activeEpisode
      ? episodes.findIndex((ep) => ep.number === activeEpisode)
      : -1;
    return index >= 0 ? Math.floor(index / EP_PER_PAGE) + 1 : 1;
  });
  const [epOrder, setEpOrder] = useState<"asc" | "desc">("asc");
  const [query, setQuery] = useState("");

  // Viewer's per-episode watch progress (percent), from watch history.
  const progressByEpisode = new Map(
    (user?.historyEntries || [])
      .filter((entry) => entry.animeId === anime.id)
      .map((entry) => [entry.episode, entry.progressPercent]),
  );
  const fillerEpisodes = new Set(anime.episodeFlags?.filler || []);
  const recapEpisodes = new Set(anime.episodeFlags?.recap || []);
  // Real dub coverage from AnimeSchedule; null = unknown, show nothing.
  const dubbedEpisodeCount = anime.dubInfo?.dubbedEpisodes ?? null;

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? episodes.filter(
        (ep) =>
          String(ep.number).includes(normalizedQuery) ||
          (ep.title || "").toLowerCase().includes(normalizedQuery) ||
          (ep.description || "").toLowerCase().includes(normalizedQuery),
      )
    : episodes;

  const sorted = epOrder === "asc" ? filtered : [...filtered].reverse();
  const paged = sorted.slice((epPage - 1) * EP_PER_PAGE, epPage * EP_PER_PAGE);
  const rangeLabel =
    paged.length > 0
      ? `${paged[0].number} - ${paged[paged.length - 1].number}`
      : "0 - 0";
  const totalPages = Math.max(1, Math.ceil(filtered.length / EP_PER_PAGE));

  function episodeHref(episodeNumber: number): string {
    const params = new URLSearchParams({ ep: String(episodeNumber) });

    if (watchQuery?.sid) {
      params.set("sid", watchQuery.sid);
    }

    if (watchQuery?.server) {
      params.set("server", watchQuery.server);
    }

    if (watchQuery?.audio) {
      params.set("audio", watchQuery.audio);
    }

    return `/watch/${anime.id}?${params.toString()}`;
  }

  return (
    <div className="tab-episodes">
      <div className="episodes-header-modern">
        <div className="ep-header-left">
          <div className="ep-count-pill">{episodes.length} Episodes</div>
          <div className="ep-pagination-modern">
            <button
              className="ep-nav-btn"
              onClick={() => setEpPage(1)}
              disabled={epPage === 1}
              title="First Page"
            >
              <ChevronsLeft size={16} />
            </button>
            <button
              className="ep-nav-btn"
              onClick={() => setEpPage((p) => Math.max(1, p - 1))}
              disabled={epPage === 1}
              title="Previous Page"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="ep-range-pill">{rangeLabel}</div>
            <button
              className="ep-nav-btn"
              onClick={() => setEpPage((p) => Math.min(totalPages, p + 1))}
              disabled={epPage >= totalPages}
              title="Next Page"
            >
              <ChevronRight size={16} />
            </button>
            <button
              className="ep-nav-btn"
              onClick={() => setEpPage(totalPages)}
              disabled={epPage >= totalPages}
              title="Last Page"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>

        <div className="ep-header-right">
          <label className="ep-search">
            <Search size={16} aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setEpPage(1);
              }}
              placeholder="Search number, title, description..."
              aria-label="Search episodes"
            />
          </label>
          <button
            className="ep-action-btn"
            onClick={() => router.refresh()}
            title="Refresh data"
          >
            <RotateCcw size={18} />
          </button>
          <button
            className="ep-action-btn"
            onClick={() => {
              setEpOrder((o) => (o === "asc" ? "desc" : "asc"));
              setEpPage(1);
            }}
            title={epOrder === "asc" ? "Sort Descending" : "Sort Ascending"}
          >
            {epOrder === "asc" ? (
              <ArrowDown01 size={18} />
            ) : (
              <ArrowDown10 size={18} />
            )}
          </button>
        </div>
      </div>

      {!paged.length ? (
        <div className="empty-panel">
          No episodes match &quot;{query.trim()}&quot;.
        </div>
      ) : null}

      <div className="episode-grid-new">
        {paged.map((ep) => {
          const progress = progressByEpisode.get(ep.number);
          const watched = progress !== undefined;
          const cardClass = [
            "episode-card-new",
            watched ? "watched" : "",
            ep.number === activeEpisode ? "active" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <Link key={ep.number} href={episodeHref(ep.number)} className={cardClass}>
              <div className="ep-thumb">
                <EpisodeThumbnail
                  src={ep.thumbnail}
                  alt={ep.title || `Ep ${ep.number}`}
                  fallbackSrc={anime.bannerImage || anime.coverImage || null}
                />
              </div>
              <div className="ep-info">
                <span className="ep-meta-row">
                  <span className="ep-meta-item">Ep {ep.number}</span>
                  {formatIsoDate(ep.airDate) ? (
                    <span className="ep-meta-item" title="Release date">
                      {formatIsoDate(ep.airDate)}
                    </span>
                  ) : null}
                  {ep.rating != null ? (
                    <span className="ep-meta-item" title="Episode rating">
                      ★ {ep.rating.toFixed(1)}
                    </span>
                  ) : null}
                  {dubbedEpisodeCount !== null ? (
                    <span className="ep-meta-item">
                      {ep.number <= dubbedEpisodeCount ? "Sub • Dub" : "Sub"}
                    </span>
                  ) : null}
                  {watched ? (
                    <span className="ep-meta-item">Watched</span>
                  ) : null}
                  {ep.number === activeEpisode ? (
                    <span className="ep-meta-item ep-now-playing">
                      Now playing
                    </span>
                  ) : null}
                  {fillerEpisodes.has(ep.number) ? (
                    <span className="ep-flag-chip">Filler</span>
                  ) : null}
                  {recapEpisodes.has(ep.number) ? (
                    <span className="ep-flag-chip">Recap</span>
                  ) : null}
                </span>
                <strong>{ep.title || `Episode ${ep.number}`}</strong>
                <p className="ep-description-text">
                  {ep.description || `Watch episode ${ep.number}.`}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
