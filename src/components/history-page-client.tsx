"use client";

import Link from "next/link";
import { Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { EpisodeThumbnail } from "@/components/episode-thumbnail";
import type { HistoryEntry } from "@/types/account";
import { getDisplayTitle } from "@/lib/format";
import { useTitleLanguage } from "@/components/use-title-language";

function groupLabel(value: string) {
  const date = new Date(value);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  const sameDay = date.toDateString() === now.toDateString();
  const sameAsYesterday = date.toDateString() === yesterday.toDateString();

  if (sameDay) {
    return "Today";
  }
  if (sameAsYesterday) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function matchesQuery(entry: HistoryEntry, query: string): boolean {
  const haystack = [
    entry.episodeTitle,
    getDisplayTitle(entry.anime.title),
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

  return haystack.includes(query);
}

export function HistoryPageClient({ entries }: { entries: HistoryEntry[] }) {
  const titleLanguage = useTitleLanguage();
  const [historyEntries, setHistoryEntries] = useState(entries);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const groups = useMemo(() => {
    const filtered = normalizedQuery
      ? historyEntries.filter((entry) => matchesQuery(entry, normalizedQuery))
      : historyEntries;

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
  }, [historyEntries, normalizedQuery, titleLanguage]);
  const groupEntries = Object.entries(groups);

  function clearHistory() {
    if (!window.confirm("Clear your entire watch history? This cannot be undone.")) {
      return;
    }

    void fetch("/api/history", { method: "DELETE" }).then((response) => {
      if (response.ok) {
        setHistoryEntries([]);
      }
    });
  }

  return (
    <div className="history-layout page-shell">
      <div className="history-toolbar">
        <label className="history-search">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by anime, episode title, or episode number"
          />
        </label>
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
                {items.map((entry) => (
                  <Link
                    href={`/watch/${entry.animeId}?ep=${entry.episode}`}
                    className="history-card"
                    key={entry.id}
                  >
                    <span className="history-card-thumb">
                      <EpisodeThumbnail
                        src={entry.episodeImage || null}
                        alt={entry.episodeTitle}
                        fallbackSrc={
                          entry.anime.bannerImage ||
                          entry.anime.coverImage ||
                          null
                        }
                      />
                    </span>
                    <span className="history-card-copy">
                      <span className="ep-meta-row">
                        <span className="ep-meta-item">
                          Ep {entry.episode}
                        </span>
                        {entry.durationLabel ? (
                          <span className="ep-meta-item">
                            {entry.durationLabel}
                          </span>
                        ) : null}
                        <span className="ep-meta-item" suppressHydrationWarning>
                          {timeLabel(entry.watchedAt)}
                        </span>
                      </span>
                      <strong>{entry.episodeTitle}</strong>
                      <small>{getDisplayTitle(entry.anime.title, titleLanguage)}</small>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))
        ) : (
          <section className="empty-state">
            <h1>
              {normalizedQuery
                ? `Nothing in your history matches "${query.trim()}"`
                : "No watch history yet"}
            </h1>
            <p>
              {normalizedQuery
                ? "Try an anime name, episode title, or episode number."
                : "Episodes you open from the watch page will show up here."}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
