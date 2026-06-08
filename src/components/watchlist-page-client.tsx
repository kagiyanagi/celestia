"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown01,
  ArrowDown10,
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
import { useAuth } from "@/components/auth-provider";
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

type SortOrder = "asc" | "desc";

function sortEntries(entries: LibraryEntry[], order: SortOrder): LibraryEntry[] {
  const direction = order === "asc" ? 1 : -1;

  return [...entries].sort((first, second) => {
    const firstTime = new Date(first.updatedAt).getTime() || 0;
    const secondTime = new Date(second.updatedAt).getTime() || 0;
    return (firstTime - secondTime) * direction;
  });
}

export function WatchlistPageClient({ entries }: { entries: LibraryEntry[] }) {
  const router = useRouter();
  const { loading, refreshUser, user } = useAuth();
  const titleLanguage = useTitleLanguage();
  const [activeTab, setActiveTab] =
    useState<(typeof tabs)[number]["key"]>("all");
  const [editing, setEditing] = useState<LibraryEntry | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const listEntries = user?.libraryEntries || entries;
  const filtered = useMemo(
    () => {
      const tabEntries =
        activeTab === "all"
          ? listEntries
          : listEntries.filter((entry) => entry.status === activeTab);

      return sortEntries(tabEntries, sortOrder);
    },
    [activeTab, listEntries, sortOrder],
  );
  const activeTabLabel =
    activeTab === "all"
      ? "Your list"
      : tabs.find((tab) => tab.key === activeTab)?.label || "Your list";

  async function handleRefresh() {
    setIsRefreshing(true);

    try {
      // Force an AniList pull so manual refresh always reconciles, bypassing
      // the freshness guard; refreshUser then loads the merged result.
      await fetch("/api/anilist/sync", {
        method: "POST",
        cache: "no-store",
      }).catch(() => null);
      await refreshUser();
      router.refresh();
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <div className="page-shell watchlist-page">
      <div className="watchlist-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const count =
            tab.key === "all"
              ? listEntries.length
              : listEntries.filter((entry) => entry.status === tab.key).length;
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
        <div className="watchlist-section-head">
          <h2>{activeTabLabel}</h2>
          <div className="list-action-buttons" aria-label="List controls">
            <button
              type="button"
              className={`list-action-button${isRefreshing ? " is-refreshing" : ""}`}
              aria-label="Refresh list"
              title="Refresh list"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing || loading}
            >
              <RotateCcw size={18} aria-hidden />
            </button>
            <button
              type="button"
              className="list-action-button"
              aria-label={
                sortOrder === "asc" ? "Sort descending" : "Sort ascending"
              }
              title={
                sortOrder === "asc" ? "Sort descending" : "Sort ascending"
              }
              onClick={() =>
                setSortOrder((current) =>
                  current === "asc" ? "desc" : "asc",
                )
              }
            >
              {sortOrder === "asc" ? (
                <ArrowDown01 size={18} aria-hidden />
              ) : (
                <ArrowDown10 size={18} aria-hidden />
              )}
            </button>
          </div>
        </div>
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
