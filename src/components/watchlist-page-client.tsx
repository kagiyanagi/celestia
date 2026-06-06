"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Bookmark,
  Check,
  List,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Ban,
  Captions,
  Radio,
  Star,
} from "lucide-react";
import { useMemo, useState } from "react";
import { DubBadge } from "@/components/dub-badge";
import { LibraryEntryDialog } from "@/components/library-entry-dialog";
import { LibraryStatusChip } from "@/components/library-status-chip";
import type { LibraryEntry, LibraryStatus } from "@/types/account";
import { getDisplayTitle, scoreLabel } from "@/lib/format";
import { useTitleLanguage } from "@/components/use-title-language";

const tabs: Array<{
  key: "all" | LibraryStatus;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}> = [
  { key: "all", label: "All", icon: List },
  { key: "planning", label: "Planning", icon: Bookmark },
  { key: "watching", label: "Watching", icon: Play },
  { key: "on_hold", label: "On hold", icon: Pause },
  { key: "dropped", label: "Dropped", icon: Ban },
  { key: "completed", label: "Finished", icon: Check },
  { key: "rewatching", label: "Rewatching", icon: RotateCcw },
];

export function WatchlistPageClient({ entries }: { entries: LibraryEntry[] }) {
  const titleLanguage = useTitleLanguage();
  const [activeTab, setActiveTab] =
    useState<(typeof tabs)[number]["key"]>("all");
  const [editing, setEditing] = useState<LibraryEntry | null>(null);
  const filtered = useMemo(
    () =>
      activeTab === "all"
        ? entries
        : entries.filter((entry) => entry.status === activeTab),
    [activeTab, entries],
  );

  return (
    <div className="page-shell watchlist-page">
      <div className="watchlist-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const count =
            tab.key === "all"
              ? entries.length
              : entries.filter((entry) => entry.status === tab.key).length;
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
        <h2>
          {activeTab === "all"
            ? "Your list"
            : tabs.find((tab) => tab.key === activeTab)?.label}
        </h2>
        {filtered.length ? (
          <div className="anime-grid search-results">
            {filtered.map((entry) => (
              <Link
                href={`/anime/${entry.animeId}`}
                className="anime-card watchlist-grid-card"
                key={entry.id}
              >
                <span className="poster-shell">
                  {entry.anime.coverImage ? (
                    <Image
                      src={entry.anime.coverImage}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 45vw, 240px"
                      className="poster-image"
                    />
                  ) : (
                    <span className="poster-fallback">Celestia</span>
                  )}
                  <LibraryStatusChip status={entry.status} />
                  <button
                    type="button"
                    className="watchlist-grid-card-edit"
                    aria-label="Edit list entry"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setEditing(entry);
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                </span>

                <span className="anime-card-body">
                  <span className="anime-card-meta-top">
                    <span>
                      {entry.anime.format === "TV"
                        ? "TV Show"
                        : entry.anime.format || "Anime"}
                    </span>
                    <span>{entry.anime.seasonYear || "Now"}</span>
                  </span>
                  <span className="anime-card-title">
                    {entry.anime.status === "RELEASING" && (
                      <Radio
                        size={14}
                        className="anime-card-airing-icon"
                        aria-hidden
                      />
                    )}
                    {getDisplayTitle(entry.anime.title, titleLanguage)}
                  </span>
                  <span className="anime-card-stats">
                    <span title="Score">
                      <Star size={12} aria-hidden />
                      {scoreLabel(entry.anime.averageScore)}
                    </span>
                    {entry.anime.airingCount != null ? (
                      <span title="Airing/Sub">
                        <Captions size={12} aria-hidden />
                        {entry.anime.airingCount}
                      </span>
                    ) : null}
                    <DubBadge
                      animeId={entry.animeId}
                      initial={entry.anime.dubCount ?? null}
                      withTitle
                    />
                  </span>
                </span>
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
      {editing ? (
        <LibraryEntryDialog
          anime={editing.anime}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
