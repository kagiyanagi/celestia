"use client";

import Image from "next/image";
import Link from "next/link";
import { Bookmark, Check, List, Pause, Pencil, Play, RotateCcw, Ban } from "lucide-react";
import { useMemo, useState } from "react";
import type { LibraryEntry, LibraryStatus } from "@/types/account";
import { getDisplayTitle } from "@/lib/format";

const tabs: Array<{ key: "all" | LibraryStatus; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { key: "all", label: "All", icon: List },
  { key: "planning", label: "Planning", icon: Bookmark },
  { key: "watching", label: "Watching", icon: Play },
  { key: "on_hold", label: "On hold", icon: Pause },
  { key: "dropped", label: "Dropped", icon: Ban },
  { key: "completed", label: "Finished", icon: Check },
  { key: "rewatching", label: "Rewatching", icon: RotateCcw },
];

export function WatchlistPageClient({ entries }: { entries: LibraryEntry[] }) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["key"]>("all");
  const filtered = useMemo(
    () => (activeTab === "all" ? entries : entries.filter((entry) => entry.status === activeTab)),
    [activeTab, entries],
  );

  return (
    <div className="page-shell watchlist-page">
      <div className="watchlist-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const count = tab.key === "all" ? entries.length : entries.filter((entry) => entry.status === tab.key).length;
          return (
            <button
              key={tab.key}
              className={activeTab === tab.key ? "active" : ""}
              type="button"
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon size={16} />
              {tab.label}
              <span>{count}</span>
            </button>
          );
        })}
      </div>
      <section className="watchlist-section">
        <h2>{activeTab === "all" ? "Your list" : tabs.find((tab) => tab.key === activeTab)?.label}</h2>
        {filtered.length ? (
          <div className="watchlist-grid-page">
            {filtered.map((entry) => (
              <Link href={`/anime/${entry.animeId}`} className="watchlist-grid-card" key={entry.id}>
                <span className="watchlist-grid-card-image">
                  {entry.anime.coverImage ? (
                    <Image src={entry.anime.coverImage} alt="" fill sizes="240px" className="poster-image" />
                  ) : null}
                  <span className="watchlist-grid-card-edit">
                    <Pencil size={16} />
                  </span>
                </span>
                <span className="watchlist-card-meta">
                  <span>{entry.anime.format === "TV" ? "TV Show" : entry.anime.format || "Anime"}</span>
                  <span>{entry.anime.seasonYear || "Now"}</span>
                </span>
                <strong>{getDisplayTitle(entry.anime.title)}</strong>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h1>No titles in this list</h1>
            <p>Use the save button on an anime page to add titles here.</p>
          </div>
        )}
      </section>
    </div>
  );
}
