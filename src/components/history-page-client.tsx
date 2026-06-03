"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { EpisodeThumbnail } from "@/components/episode-thumbnail";
import type { HistoryEntry } from "@/types/account";
import { getDisplayTitle } from "@/lib/format";

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

export function HistoryPageClient({ entries }: { entries: HistoryEntry[] }) {
  const [historyEntries, setHistoryEntries] = useState(entries);
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const filtered = historyEntries.filter((entry) => {
      const haystack = `${entry.episodeTitle} ${getDisplayTitle(entry.anime.title)}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    });

    return filtered.reduce<Record<string, HistoryEntry[]>>((accumulator, entry) => {
      const key = groupLabel(entry.watchedAt);
      accumulator[key] ||= [];
      accumulator[key].push(entry);
      return accumulator;
    }, {});
  }, [historyEntries, query]);
  const groupEntries = Object.entries(groups);

  return (
    <div className="history-layout page-shell">
      <div className="history-main">
        {groupEntries.length ? groupEntries.map(([label, items]) => (
          <section key={label} className="history-group">
            <h2>{label}</h2>
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
                      fallbackSrc={entry.anime.bannerImage || entry.anime.coverImage || null}
                    />
                    <span className="continue-card-episode">EP {entry.episode}</span>
                    {entry.durationLabel ? (
                      <span className="continue-card-duration">{entry.durationLabel}</span>
                    ) : null}
                    <span className="continue-card-progress">
                      <span style={{ width: `${entry.progressPercent}%` }} />
                    </span>
                  </span>
                  <span className="history-card-copy">
                    <strong>{entry.episodeTitle}</strong>
                    <small>{getDisplayTitle(entry.anime.title)}</small>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )) : (
          <section className="empty-state">
            <h1>No watch history yet</h1>
            <p>Episodes you open from the watch page will show up here.</p>
          </section>
        )}
      </div>
      <aside className="history-sidebar">
        <label className="history-search">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search through history"
          />
        </label>
        <button
          className="text-action danger"
          type="button"
          onClick={() => {
            void fetch("/api/history", { method: "DELETE" }).then((response) => {
              if (response.ok) {
                setHistoryEntries([]);
              }
            });
          }}
          disabled={!historyEntries.length}
        >
          Clear watch history
        </button>
      </aside>
    </div>
  );
}
