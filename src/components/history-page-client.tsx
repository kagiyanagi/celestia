"use client";

import Link from "next/link";
import { Compass, PlayCircle, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EpisodeThumbnail } from "@/components/episode-thumbnail";
import type { HistoryEntry } from "@/types/account";
import { getDisplayTitle } from "@/lib/format";
import { useTitleLanguage } from "@/components/use-title-language";
import { getResumeEpisode } from "@/lib/resume";
import { buildWatchHref } from "@/lib/watch-href";
import { buildBrowseHref, EMPTY_BROWSE_FILTERS } from "@/lib/browse-filters";

// Matches the resume threshold in lib/resume.ts: an episode is "finished" once
// it crosses 90%, otherwise it still counts as in-progress.
const FINISHED_AT = 90;

type StatusFilter = "all" | "progress" | "finished";

function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function groupLabel(value: string): string {
  const target = startOfDay(new Date(value));
  const today = startOfDay(new Date());
  const dayDiff = Math.round(
    (today.getTime() - target.getTime()) / 86_400_000,
  );

  if (dayDiff <= 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff < 7) return "This week";
  if (dayDiff < 14) return "Last week";

  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(target);
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

// Consecutive days (ending today, with a one-day grace) that have at least one
// watched episode. Built from local-midnight keys so it survives month rollover.
function computeStreak(entries: HistoryEntry[]): number {
  const days = new Set(
    entries.map((entry) => startOfDay(new Date(entry.watchedAt)).getTime()),
  );

  if (!days.size) return 0;

  const cursor = startOfDay(new Date());
  if (!days.has(cursor.getTime())) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (days.has(cursor.getTime())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function HistoryPageClient({
  entries,
  pauseHistory,
}: {
  entries: HistoryEntry[];
  pauseHistory: boolean;
}) {
  const titleLanguage = useTitleLanguage();
  const [historyEntries, setHistoryEntries] = useState(entries);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [paused, setPaused] = useState(pauseHistory);
  // Holds the cleared entries while the Undo window is open; the server delete
  // is deferred until the window closes, so Undo never needs a re-create.
  const [pendingClear, setPendingClear] = useState<HistoryEntry[] | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const normalizedQuery = query.trim().toLowerCase();

  type EnrichedEp = { number: number; title: string | null; thumbnail: string | null };
  const [enrichedEpisodes, setEnrichedEpisodes] = useState<Record<number, EnrichedEp[]>>({});

  const uniqueAnimeIds = useMemo(() => {
    return Array.from(new Set(historyEntries.map((entry) => entry.animeId)));
  }, [historyEntries]);

  const uniqueAnimeIdsStr = JSON.stringify(uniqueAnimeIds);

  useEffect(() => {
    const ids = JSON.parse(uniqueAnimeIdsStr) as number[];
    if (!ids.length) return;

    const controller = new AbortController();

    ids.forEach((animeId) => {
      fetch(`/api/anime/${animeId}/episodes`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: { episodes?: EnrichedEp[] } | null) => {
          if (payload?.episodes) {
            setEnrichedEpisodes((prev) => ({
              ...prev,
              [animeId]: payload.episodes || [],
            }));
          }
        })
        .catch(() => {});
    });

    return () => controller.abort();
  }, [uniqueAnimeIdsStr]);

  const stats = useMemo(() => {
    const shows = new Set(historyEntries.map((entry) => entry.animeId));
    const weekAgo = new Date().getTime() - 7 * 86_400_000;
    const thisWeek = historyEntries.filter(
      (entry) => new Date(entry.watchedAt).getTime() >= weekAgo,
    ).length;

    const genreCounts = new Map<string, number>();
    for (const entry of historyEntries) {
      for (const genre of entry.anime.genres ?? []) {
        genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
      }
    }
    const topGenre =
      [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return {
      episodes: historyEntries.length,
      shows: shows.size,
      thisWeek,
      streak: computeStreak(historyEntries),
      topGenre,
    };
  }, [historyEntries]);

  const groups = useMemo(() => {
    const filtered = historyEntries.filter((entry) => {
      if (status === "finished" && entry.progressPercent < FINISHED_AT) {
        return false;
      }
      if (status === "progress" && entry.progressPercent >= FINISHED_AT) {
        return false;
      }

      if (normalizedQuery) {
        const episodesList = enrichedEpisodes[entry.animeId];
        const targetMeta = episodesList?.find((ep) => ep.number === entry.episode);

        const isGenericTitle = (val: string | null | undefined, num: number) => {
          if (!val) return true;
          const normalized = val.trim().toLowerCase();
          return normalized === `episode ${num}` || normalized === `ep ${num}`;
        };

        const rawTitle = targetMeta?.title || entry.episodeTitle;
        const displayTitle = !isGenericTitle(rawTitle, entry.episode)
          ? rawTitle
          : `Episode ${entry.episode}`;

        const haystack = [
          displayTitle,
          entry.episodeTitle,
          getDisplayTitle(entry.anime.title, titleLanguage),
          entry.anime.title?.romaji,
          entry.anime.title?.english,
          entry.anime.title?.native,
          String(entry.episode),
          `ep ${entry.episode}`,
          `episode ${entry.episode}`,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      }

      return true;
    });

    // While searching, group by anime (episodes in order) so a title query
    // reads as "every episode of this show you've watched". Otherwise keep
    // the chronological day groups.
    if (normalizedQuery) {
      const byAnime = filtered.reduce<Record<string, HistoryEntry[]>>(
        (accumulator, entry) => {
          const key = getDisplayTitle(entry.anime.title, titleLanguage);
          accumulator[key] ||= [];
          accumulator[key].push(entry);
          return accumulator;
        },
        {},
      );

      Object.values(byAnime).forEach((items) =>
        items.sort((first, second) => first.episode - second.episode),
      );

      return byAnime;
    }

    return filtered.reduce<Record<string, HistoryEntry[]>>(
      (accumulator, entry) => {
        const key = groupLabel(entry.watchedAt);
        accumulator[key] ||= [];
        accumulator[key].push(entry);
        return accumulator;
      },
      {},
    );
  }, [historyEntries, enrichedEpisodes, normalizedQuery, status, titleLanguage]);
  const groupEntries = Object.entries(groups);

  function removeEntry(id: string) {
    setHistoryEntries((prev) => prev.filter((entry) => entry.id !== id));
    void fetch(`/api/history?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  function clearHistory() {
    if (!historyEntries.length) return;

    const stash = historyEntries;
    setPendingClear(stash);
    setHistoryEntries([]);

    clearTimer.current = setTimeout(() => {
      void fetch("/api/history", { method: "DELETE" });
      clearTimer.current = null;
      setPendingClear(null);
    }, 6000);
  }

  function undoClear() {
    if (clearTimer.current) {
      clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
    if (pendingClear) {
      setHistoryEntries(pendingClear);
    }
    setPendingClear(null);
  }

  function resumeHistory() {
    setPaused(false);
    void fetch("/api/me/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pauseHistory: false }),
    }).then((response) => {
      if (!response.ok) setPaused(true);
    });
  }

  const filters: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "progress", label: "Continue" },
    { value: "finished", label: "Finished" },
  ];

  return (
    <div className="history-layout page-shell">
      {paused ? (
        <div className="history-pause-banner" role="status">
          <span>
            History is paused — new episodes you watch aren&apos;t being
            recorded.
          </span>
          <button type="button" onClick={resumeHistory}>
            Resume tracking
          </button>
        </div>
      ) : null}

      {historyEntries.length ? (
        <div className="history-summary">
          <span className="history-stat">
            <strong>{stats.episodes}</strong>
            <small>Episodes watched</small>
          </span>
          <span className="history-stat">
            <strong>{stats.shows}</strong>
            <small>Series</small>
          </span>
          <span className="history-stat">
            <strong>{stats.thisWeek}</strong>
            <small>This week</small>
          </span>
          <span className="history-stat">
            <strong>{stats.streak}</strong>
            <small>Day streak</small>
          </span>
          {stats.topGenre ? (
            <Link
              className="history-discover"
              href={buildBrowseHref("/search", {
                ...EMPTY_BROWSE_FILTERS,
                genre: stats.topGenre,
              })}
            >
              <Compass size={16} aria-hidden />
              <span>
                More <strong>{stats.topGenre}</strong>
              </span>
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="history-toolbar">
        <label className="history-search">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by anime, episode title, or episode number"
          />
        </label>
        <div className="history-filters" role="tablist">
          {filters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              role="tab"
              aria-selected={status === filter.value}
              className={status === filter.value ? "is-active" : undefined}
              onClick={() => setStatus(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <button
          className="history-clear"
          type="button"
          onClick={clearHistory}
          disabled={!historyEntries.length}
        >
          <Trash2 size={16} aria-hidden />
          Clear history
        </button>
      </div>

      <div className="history-main">
        {groupEntries.length ? (
          groupEntries.map(([label, items]) => (
            <section key={label} className="history-group">
              <h2>
                {label}
                {normalizedQuery ? (
                  <span className="history-group-count">
                    {items.length} episode{items.length === 1 ? "" : "s"} watched
                  </span>
                ) : null}
              </h2>
              <div className="history-stack">
                {items.map((entry) => {
                  const episodesList = enrichedEpisodes[entry.animeId];
                  const targetMeta = episodesList?.find((ep) => ep.number === entry.episode);

                  const displayImage = targetMeta?.thumbnail || entry.episodeImage || null;

                  const isGenericTitle = (val: string | null | undefined, num: number) => {
                    if (!val) return true;
                    const normalized = val.trim().toLowerCase();
                    return normalized === `episode ${num}` || normalized === `ep ${num}`;
                  };

                  const rawTitle = targetMeta?.title || entry.episodeTitle;
                  const displayTitle = !isGenericTitle(rawTitle, entry.episode)
                    ? rawTitle
                    : `Episode ${entry.episode}`;

                  return (
                    <div className="history-card-wrap" key={entry.id}>
                      <Link
                        href={buildWatchHref({
                          animeId: entry.animeId,
                          episode: getResumeEpisode(entry),
                        })}
                        className="history-card"
                      >
                        <span className="history-card-thumb">
                          <EpisodeThumbnail
                            src={displayImage}
                            alt={displayTitle || entry.episodeTitle}
                            fallbackSrc={
                              entry.anime.bannerImage ||
                              entry.anime.coverImage ||
                              null
                            }
                          />
                          {entry.progressPercent > 0 ? (
                            <span className="history-card-progress">
                              <span
                                style={{
                                  width: `${Math.min(100, entry.progressPercent)}%`,
                                }}
                              />
                            </span>
                          ) : null}
                        </span>
                        <span className="history-card-copy">
                          <span className="ep-meta-row">
                            <span className="ep-meta-item">Ep {entry.episode}</span>
                            {entry.durationLabel ? (
                              <span className="ep-meta-item">
                                {entry.durationLabel}
                              </span>
                            ) : null}
                            <span
                              className="ep-meta-item"
                              suppressHydrationWarning
                            >
                              {timeLabel(entry.watchedAt)}
                            </span>
                            {entry.progressPercent > 0 &&
                            entry.progressPercent < FINISHED_AT ? (
                              <span className="ep-meta-item history-card-resume">
                                <PlayCircle size={13} aria-hidden />
                                {Math.round(entry.progressPercent)}%
                              </span>
                            ) : null}
                          </span>
                          <strong>{displayTitle}</strong>
                          <small>
                            {getDisplayTitle(entry.anime.title, titleLanguage)}
                          </small>
                        </span>
                      </Link>
                      <button
                        type="button"
                        className="history-card-remove"
                        aria-label="Remove from history"
                        onClick={() => removeEntry(entry.id)}
                      >
                        <X size={16} aria-hidden />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        ) : (
          <section className="empty-state">
            <h1>
              {normalizedQuery || status !== "all"
                ? "Nothing here matches your filters"
                : "No watch history yet"}
            </h1>
            <p>
              {normalizedQuery || status !== "all"
                ? "Try a different search or switch the filter back to All."
                : "Episodes you open from the watch page will show up here."}
            </p>
          </section>
        )}
      </div>

      {pendingClear ? (
        <div className="history-snackbar" role="status">
          <span>History cleared.</span>
          <button type="button" onClick={undoClear}>
            Undo
          </button>
        </div>
      ) : null}
    </div>
  );
}
