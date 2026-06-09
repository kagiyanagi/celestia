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
  Filter,
  Mic,
  SkipForward,
  Check,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { EpisodeThumbnail } from "@/components/episode-thumbnail";
import { useWatchSelection } from "@/components/watch-selection-context";
import { buildWatchHref } from "@/lib/watch-href";
import { formatIsoDate } from "@/lib/format";
import {
  EPISODES_PER_PAGE,
  matchesEpisodeQuery,
} from "@/lib/episode-pagination";
import type { AnimeDetails, AnimeSummary } from "@/types/anime";

const EP_PER_PAGE = EPISODES_PER_PAGE;

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

export type EpisodeBrowserAnime = Pick<
  AnimeDetails,
  "id" | "bannerImage" | "coverImage" | "dubInfo" | "episodeFlags"
>;

/**
 * Shared episode list (details Episodes tab + watch page): search by
 * number/title/description, pagination, sort order, watched dimming with
 * progress, dub availability, and filler/recap tags. The full list lives in
 * the client payload, so search/sort/paging are all instant and client-side.
 */
export function EpisodeBrowser({
  anime,
  episodes,
  watchQuery,
  activeEpisode = null,
  trackingAnime,
}: {
  anime: EpisodeBrowserAnime;
  episodes: BrowserEpisode[];
  watchQuery?: EpisodeWatchQuery;
  activeEpisode?: number | null;
  // Full summary needed to record history from a card. When omitted (e.g. the
  // details page) the per-card "mark watched" control is hidden.
  trackingAnime?: AnimeSummary;
}) {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  // On the watch page, the live in-place server/audio selection wins so episode
  // links match what's actually playing; elsewhere fall back to the prop.
  const selection = useWatchSelection();
  const activeQuery: EpisodeWatchQuery = selection
    ? {
        sid: selection.sid ? String(selection.sid) : null,
        server: selection.server,
        audio: selection.audio,
      }
    : watchQuery ?? {};
  const [epPage, setEpPage] = useState(() => {
    const index = activeEpisode
      ? episodes.findIndex((ep) => ep.number === activeEpisode)
      : -1;
    return index >= 0 ? Math.floor(index / EP_PER_PAGE) + 1 : 1;
  });
  const [epOrder, setEpOrder] = useState<"asc" | "desc">("asc");
  const [query, setQuery] = useState("");
  const [hideFiller, setHideFiller] = useState(false);
  const [dubOnly, setDubOnly] = useState(false);
  const [gotoValue, setGotoValue] = useState("");
  const [markingEpisode, setMarkingEpisode] = useState<number | null>(null);

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

  // Filler/recap counts only consider episodes actually in the list, so the
  // summary never claims more than the verified episode rows.
  const fillerCount = episodes.filter((ep) =>
    fillerEpisodes.has(ep.number),
  ).length;
  const canonCount = episodes.length - fillerCount;
  const fillerPercent =
    episodes.length > 0 ? Math.round((fillerCount / episodes.length) * 100) : 0;

  // First episode the viewer hasn't started yet, in release order — drives the
  // "jump to next unwatched" shortcut. Null when everything's been watched.
  const nextUnwatched =
    episodes.find((ep) => !progressByEpisode.has(ep.number))?.number ?? null;

  const normalizedQuery = query.trim().toLowerCase();
  // Filter/sort/slice the full in-memory list.
  let clientFiltered = normalizedQuery
    ? episodes.filter((ep) => matchesEpisodeQuery(ep, normalizedQuery))
    : episodes;
  if (hideFiller && fillerCount > 0) {
    clientFiltered = clientFiltered.filter((ep) => !fillerEpisodes.has(ep.number));
  }
  if (dubOnly && dubbedEpisodeCount) {
    clientFiltered = clientFiltered.filter((ep) => ep.number <= dubbedEpisodeCount);
  }
  const clientSorted =
    epOrder === "asc" ? clientFiltered : [...clientFiltered].reverse();

  const paged = clientSorted.slice(
    (epPage - 1) * EP_PER_PAGE,
    epPage * EP_PER_PAGE,
  );
  const matchedCount = clientFiltered.length;
  const episodeCount = episodes.length;
  const rangeLabel =
    paged.length > 0
      ? `${paged[0].number} - ${paged[paged.length - 1].number}`
      : "0 - 0";
  const totalPages = Math.max(1, Math.ceil(matchedCount / EP_PER_PAGE));

  // Reset narrowing filters so the target is guaranteed visible, then page to
  // the next-unwatched episode in the current sort order.
  function jumpToNextUnwatched() {
    if (nextUnwatched == null) return;
    setQuery("");
    setHideFiller(false);
    setDubOnly(false);
    const ordered = epOrder === "asc" ? episodes : [...episodes].reverse();
    const index = ordered.findIndex((ep) => ep.number === nextUnwatched);
    if (index >= 0) {
      setEpPage(Math.floor(index / EP_PER_PAGE) + 1);
    }
  }

  // Jump straight to the page holding a typed episode number, clearing any
  // active filters so the target is guaranteed visible.
  function gotoEpisode() {
    const target = Math.floor(Number(gotoValue));
    if (!Number.isFinite(target) || target <= 0) return;
    const ordered = epOrder === "asc" ? episodes : [...episodes].reverse();
    const index = ordered.findIndex((ep) => ep.number === target);
    if (index >= 0) {
      setQuery("");
      setHideFiller(false);
      setDubOnly(false);
      setEpPage(Math.floor(index / EP_PER_PAGE) + 1);
    }
    setGotoValue("");
  }

  async function markEpisodeWatched(ep: BrowserEpisode) {
    if (!trackingAnime || markingEpisode !== null) return;
    setMarkingEpisode(ep.number);
    try {
      await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anime: trackingAnime,
          episode: ep.number,
          episodeTitle: ep.title || `Episode ${ep.number}`,
          episodeImage: ep.thumbnail,
          durationLabel: null,
          progressPercent: 100,
          progressOnly: false,
        }),
      });
      await refreshUser();
    } catch {
      // Non-fatal: leave the card unmarked if the write failed.
    } finally {
      setMarkingEpisode(null);
    }
  }

  function episodeHref(episodeNumber: number): string {
    return buildWatchHref({
      animeId: anime.id,
      episode: episodeNumber,
      providerAnimeId: activeQuery.sid ? Number(activeQuery.sid) : null,
      providerId: activeQuery.server ?? null,
      audio:
        activeQuery.audio === "sub" || activeQuery.audio === "dub"
          ? activeQuery.audio
          : null,
    });
  }

  return (
    <div className="tab-episodes">
      <div className="episodes-header-modern">
        <div className="ep-header-left">
          <div className="ep-count-pill">{episodeCount} Episodes</div>
          {fillerCount > 0 ? (
            <div
              className="ep-filler-summary"
              title={`${canonCount} canon, ${fillerCount} filler`}
            >
              {canonCount} canon · {fillerCount} filler ({fillerPercent}%)
            </div>
          ) : null}
          {nextUnwatched != null ? (
            <button
              className="ep-jump-btn"
              onClick={jumpToNextUnwatched}
              title={`Jump to episode ${nextUnwatched}`}
            >
              <SkipForward size={15} aria-hidden />
              Next unwatched
            </button>
          ) : null}
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
          <form
            className="ep-goto"
            onSubmit={(event) => {
              event.preventDefault();
              gotoEpisode();
            }}
          >
            <input
              type="number"
              min={1}
              value={gotoValue}
              onChange={(event) => setGotoValue(event.target.value)}
              placeholder="Go to #"
              aria-label="Go to episode number"
            />
          </form>
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
          {fillerCount > 0 ? (
            <button
              className={`ep-action-btn ${hideFiller ? "active" : ""}`}
              onClick={() => {
                setHideFiller((value) => !value);
                setEpPage(1);
              }}
              title={hideFiller ? "Show filler episodes" : "Hide filler episodes"}
              aria-pressed={hideFiller}
            >
              <Filter size={18} />
            </button>
          ) : null}
          {dubbedEpisodeCount ? (
            <button
              className={`ep-action-btn ${dubOnly ? "active" : ""}`}
              onClick={() => {
                setDubOnly((value) => !value);
                setEpPage(1);
              }}
              title={dubOnly ? "Show all episodes" : "Show dubbed episodes only"}
              aria-pressed={dubOnly}
            >
              <Mic size={18} />
            </button>
          ) : null}
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
                {trackingAnime && !watched ? (
                  <button
                    type="button"
                    className="ep-mark-btn"
                    title={`Mark episode ${ep.number} watched`}
                    aria-label={`Mark episode ${ep.number} watched`}
                    disabled={markingEpisode === ep.number}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void markEpisodeWatched(ep);
                    }}
                  >
                    <Check size={14} aria-hidden />
                  </button>
                ) : null}
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
