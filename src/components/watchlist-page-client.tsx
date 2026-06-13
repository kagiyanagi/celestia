"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownUp,
  Bookmark,
  Check,
  CheckSquare,
  Clock,
  LayoutGrid,
  List,
  Pause,
  Pencil,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Rows3,
  Ban,
  Captions,
  Search,
  Shuffle,
  Square,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { CustomSelect } from "@/components/custom-select";
import { DubBadge } from "@/components/dub-badge";
import { LibraryEntryDialog } from "@/components/library-entry-dialog";
import { LibraryStatusChip } from "@/components/library-status-chip";
import type { LibraryEntry, LibraryStatus } from "@/types/account";
import {
  formatCountdownSeconds,
  getDisplayTitle,
  scoreLabel,
} from "@/lib/format";
import { buildWatchHref } from "@/lib/watch-href";
import { useTitleLanguage } from "@/components/use-title-language";

type TabKey = "all" | LibraryStatus;

const tabs: Array<{
  key: TabKey;
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

const statusOptions: Array<{ value: LibraryStatus; label: string }> = [
  { value: "planning", label: "Plan to watch" },
  { value: "watching", label: "Watching" },
  { value: "on_hold", label: "On hold" },
  { value: "dropped", label: "Dropped" },
  { value: "completed", label: "Finished" },
  { value: "rewatching", label: "Rewatching" },
];

type SortKey =
  | "updated"
  | "added"
  | "title"
  | "myScore"
  | "avgScore"
  | "progress"
  | "year"
  | "nextAiring";

const sortOptions: Array<{ value: SortKey; label: string }> = [
  { value: "updated", label: "Last updated" },
  { value: "added", label: "Recently added" },
  { value: "title", label: "Title" },
  { value: "myScore", label: "Your score" },
  { value: "avgScore", label: "Average score" },
  { value: "progress", label: "Progress" },
  { value: "year", label: "Release year" },
  { value: "nextAiring", label: "Next airing" },
];

type SortOrder = "asc" | "desc";

/** Highest episode a provider has confirmed exists; null when unknown. */
function episodeCeiling(entry: LibraryEntry): number | null {
  return entry.anime.airingCount ?? entry.anime.episodes ?? null;
}

/** Episode to resume: next one when a provider confirms it exists. */
function resumeEpisode(entry: LibraryEntry): number {
  const ceiling = episodeCeiling(entry);
  const next = entry.progress + 1;
  if (ceiling != null) {
    return Math.min(Math.max(1, next), ceiling);
  }
  return Math.max(1, next);
}

/** Episodes aired/available past the user's progress; null when unknown. */
function episodesBehind(entry: LibraryEntry): number | null {
  const ceiling = episodeCeiling(entry);
  if (ceiling == null) return null;
  return Math.max(0, ceiling - entry.progress);
}

function sortComparator(
  sortKey: SortKey,
  titleLanguage: ReturnType<typeof useTitleLanguage>,
) {
  switch (sortKey) {
    case "title":
      return (a: LibraryEntry, b: LibraryEntry) =>
        getDisplayTitle(a.anime.title, titleLanguage).localeCompare(
          getDisplayTitle(b.anime.title, titleLanguage),
        );
    case "myScore":
      return (a: LibraryEntry, b: LibraryEntry) => a.score - b.score;
    case "avgScore":
      return (a: LibraryEntry, b: LibraryEntry) =>
        (a.anime.averageScore ?? -1) - (b.anime.averageScore ?? -1);
    case "progress":
      return (a: LibraryEntry, b: LibraryEntry) => a.progress - b.progress;
    case "year":
      return (a: LibraryEntry, b: LibraryEntry) =>
        (a.anime.seasonYear ?? a.anime.startDate?.year ?? 0) -
        (b.anime.seasonYear ?? b.anime.startDate?.year ?? 0);
    case "nextAiring":
      return (a: LibraryEntry, b: LibraryEntry) =>
        (a.anime.nextAiringEpisode?.airingAt ?? Number.MAX_SAFE_INTEGER) -
        (b.anime.nextAiringEpisode?.airingAt ?? Number.MAX_SAFE_INTEGER);
    case "added":
      return (a: LibraryEntry, b: LibraryEntry) =>
        new Date(a.addedAt || a.updatedAt).getTime() -
        new Date(b.addedAt || b.updatedAt).getTime();
    case "updated":
    default:
      return (a: LibraryEntry, b: LibraryEntry) =>
        (new Date(a.updatedAt).getTime() || 0) -
        (new Date(b.updatedAt).getTime() || 0);
  }
}

type InitialView = {
  tab?: string;
  sort?: string;
  order?: string;
  view?: string;
};

export function WatchlistPageClient({
  entries,
  initialView = {},
}: {
  entries: LibraryEntry[];
  initialView?: InitialView;
}) {
  const router = useRouter();
  const { loading, refreshUser, user, setUser } = useAuth();
  const titleLanguage = useTitleLanguage();
  const [activeTab, setActiveTab] = useState<TabKey>(
    tabs.some((item) => item.key === initialView.tab)
      ? (initialView.tab as TabKey)
      : "all",
  );
  const [editing, setEditing] = useState<LibraryEntry | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>(
    sortOptions.some((item) => item.value === initialView.sort)
      ? (initialView.sort as SortKey)
      : "updated",
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>(
    initialView.order === "asc" ? "asc" : "desc",
  );
  const [view, setView] = useState<"grid" | "list">(
    initialView.view === "list" ? "list" : "grid",
  );
  const [query, setQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const listEntries = user?.libraryEntries || entries;

  // Mirror view state into the URL (replace, no history entry) so a refresh or
  // shared link reopens the same view. Initial values come from the server via
  // initialView props, so there is no read-on-mount setState.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", activeTab);
    params.set("sort", sortKey);
    params.set("order", sortOrder);
    params.set("view", view);
    const next = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", next);
  }, [activeTab, sortKey, sortOrder, view]);

  // Arrow keys move between status tabs (ignored while typing in a field).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }
      setActiveTab((current) => {
        const index = tabs.findIndex((item) => item.key === current);
        const delta = event.key === "ArrowRight" ? 1 : -1;
        const nextIndex = (index + delta + tabs.length) % tabs.length;
        return tabs[nextIndex].key;
      });
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const tabEntries = listEntries.filter((entry) => {
      if (activeTab !== "all" && entry.status !== activeTab) return false;
      if (!needle) return true;
      const haystack = [
        getDisplayTitle(entry.anime.title, titleLanguage),
        entry.anime.title?.english,
        entry.anime.title?.romaji,
        entry.anime.title?.native,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });

    const direction = sortOrder === "asc" ? 1 : -1;
    const comparator = sortComparator(sortKey, titleLanguage);
    return [...tabEntries].sort((a, b) => comparator(a, b) * direction);
  }, [activeTab, listEntries, query, sortKey, sortOrder, titleLanguage]);

  const stats = useMemo(() => {
    const episodes = filtered.reduce((sum, entry) => sum + entry.progress, 0);
    const scored = filtered.filter((entry) => entry.score > 0);
    const meanScore = scored.length
      ? scored.reduce((sum, entry) => sum + entry.score, 0) / scored.length
      : null;
    return { titles: filtered.length, episodes, meanScore };
  }, [filtered]);

  const activeTabLabel =
    activeTab === "all"
      ? "Your list"
      : tabs.find((tab) => tab.key === activeTab)?.label || "Your list";

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
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

  // Persists an entry change locally (optimistic) and through the library API,
  // which mirrors it to AniList when linked.
  const persistEntry = useCallback(
    async (entry: LibraryEntry, overrides: Partial<LibraryEntry>) => {
      const next: LibraryEntry = { ...entry, ...overrides };
      setUser((current) =>
        current
          ? {
              ...current,
              libraryEntries: current.libraryEntries.map((item) =>
                item.animeId === entry.animeId ? next : item,
              ),
            }
          : current,
      );

      try {
        const response = await fetch("/api/library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            anime: next.anime,
            status: next.status,
            score: next.score,
            progress: next.progress,
            repeat: next.repeat,
            notes: next.notes,
            startedAt: next.startedAt,
            completedAt: next.completedAt,
          }),
        });
        const payload = (await response.json()) as { entry?: LibraryEntry };
        if (response.ok && payload.entry) {
          const saved = payload.entry;
          setUser((current) =>
            current
              ? {
                  ...current,
                  libraryEntries: current.libraryEntries.map((item) =>
                    item.animeId === saved.animeId ? saved : item,
                  ),
                }
              : current,
          );
        }
      } catch {
        // Optimistic update already applied; a failed write is non-fatal here.
      }
    },
    [setUser],
  );

  async function bumpEpisode(entry: LibraryEntry) {
    const ceiling = episodeCeiling(entry);
    const nextProgress = entry.progress + 1;
    if (ceiling != null && nextProgress > ceiling) return;

    setBusyIds((current) => new Set(current).add(entry.animeId));

    const reachedEnd =
      entry.anime.episodes != null && nextProgress >= entry.anime.episodes;
    const overrides: Partial<LibraryEntry> = { progress: nextProgress };
    if (
      reachedEnd &&
      (entry.status === "watching" || entry.status === "rewatching")
    ) {
      overrides.status = "completed";
      overrides.completedAt =
        entry.completedAt || new Date().toISOString().slice(0, 10);
    }

    await persistEntry(entry, overrides);
    setBusyIds((current) => {
      const next = new Set(current);
      next.delete(entry.animeId);
      return next;
    });
  }

  async function removeEntry(entry: LibraryEntry) {
    setUser((current) =>
      current
        ? {
            ...current,
            libraryEntries: current.libraryEntries.filter(
              (item) => item.animeId !== entry.animeId,
            ),
          }
        : current,
    );
    await fetch(`/api/library?animeId=${entry.animeId}`, {
      method: "DELETE",
    }).catch(() => null);
  }

  function toggleSelected(animeId: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(animeId)) {
        next.delete(animeId);
      } else {
        next.add(animeId);
      }
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  async function bulkSetStatus(status: LibraryStatus) {
    const targets = filtered.filter((entry) => selected.has(entry.animeId));
    exitSelectMode();
    for (const entry of targets) {
      await persistEntry(entry, { status });
    }
  }

  async function bulkRemove() {
    const targets = filtered.filter((entry) => selected.has(entry.animeId));
    exitSelectMode();
    for (const entry of targets) {
      await removeEntry(entry);
    }
  }

  function surpriseMe() {
    if (!filtered.length) return;
    const pick = filtered[Math.floor(Math.random() * filtered.length)];
    router.push(`/anime/${pick.animeId}`);
  }

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((entry) => selected.has(entry.animeId));

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
          <div className="watchlist-head-titles">
            <h2>{activeTabLabel}</h2>
            <p className="watchlist-stats" aria-label="List summary">
              <span>{stats.titles} titles</span>
              <span>{stats.episodes} eps watched</span>
              <span>
                Mean{" "}
                {stats.meanScore != null
                  ? scoreLabel(stats.meanScore)
                  : "-"}
              </span>
            </p>
          </div>

          <div className="watchlist-toolbar" aria-label="List controls">
            <label className="watchlist-search">
              <Search size={16} aria-hidden />
              <input
                type="search"
                value={query}
                placeholder="Search this list"
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search this list"
              />
            </label>

            <CustomSelect
              value={sortKey}
              options={sortOptions}
              ariaLabel="Sort by"
              onChange={(value) => setSortKey(value as SortKey)}
            />

            <button
              type="button"
              className="list-action-button"
              aria-label={
                sortOrder === "asc" ? "Sort descending" : "Sort ascending"
              }
              title={sortOrder === "asc" ? "Ascending" : "Descending"}
              onClick={() =>
                setSortOrder((current) => (current === "asc" ? "desc" : "asc"))
              }
            >
              <ArrowDownUp size={18} aria-hidden />
            </button>

            <button
              type="button"
              className="list-action-button"
              aria-label={view === "grid" ? "List view" : "Grid view"}
              title={view === "grid" ? "List view" : "Grid view"}
              onClick={() =>
                setView((current) => (current === "grid" ? "list" : "grid"))
              }
            >
              {view === "grid" ? (
                <Rows3 size={18} aria-hidden />
              ) : (
                <LayoutGrid size={18} aria-hidden />
              )}
            </button>

            <button
              type="button"
              className="list-action-button"
              aria-label="Surprise me"
              title="Surprise me"
              onClick={surpriseMe}
              disabled={!filtered.length}
            >
              <Shuffle size={18} aria-hidden />
            </button>

            <button
              type="button"
              className={`list-action-button${selectMode ? " is-active" : ""}`}
              aria-label={selectMode ? "Exit select mode" : "Select entries"}
              title={selectMode ? "Cancel" : "Select"}
              onClick={() =>
                selectMode ? exitSelectMode() : setSelectMode(true)
              }
            >
              <CheckSquare size={18} aria-hidden />
            </button>

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
          </div>
        </div>

        {selectMode ? (
          <div className="watchlist-bulk-bar" role="toolbar" aria-label="Bulk actions">
            <button
              type="button"
              className="watchlist-bulk-select-all"
              onClick={() =>
                setSelected(
                  allVisibleSelected
                    ? new Set()
                    : new Set(filtered.map((entry) => entry.animeId)),
                )
              }
            >
              {allVisibleSelected ? (
                <CheckSquare size={16} aria-hidden />
              ) : (
                <Square size={16} aria-hidden />
              )}
              {allVisibleSelected ? "Clear" : "Select all"}
            </button>
            <span className="watchlist-bulk-count">{selected.size} selected</span>
            <div className="watchlist-bulk-status">
              <CustomSelect
                value=""
                ariaLabel="Set status for selected"
                options={[
                  { value: "", label: "Set status…" },
                  ...statusOptions,
                ]}
                onChange={(value) => {
                  if (value) void bulkSetStatus(value as LibraryStatus);
                }}
              />
            </div>
            <button
              type="button"
              className="watchlist-bulk-remove"
              onClick={() => void bulkRemove()}
              disabled={!selected.size}
            >
              <Trash2 size={16} aria-hidden />
              Remove
            </button>
            <button
              type="button"
              className="watchlist-bulk-cancel"
              onClick={exitSelectMode}
              aria-label="Cancel"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
        ) : null}

        {filtered.length ? (
          <div
            className={
              view === "grid"
                ? "anime-grid search-results"
                : "watchlist-rows"
            }
          >
            {filtered.map((entry) =>
              view === "grid" ? (
                <WatchlistGridCard
                  key={entry.id}
                  entry={entry}
                  titleLanguage={titleLanguage}
                  busy={busyIds.has(entry.animeId)}
                  selectMode={selectMode}
                  selected={selected.has(entry.animeId)}
                  onToggleSelect={() => toggleSelected(entry.animeId)}
                  onEdit={() => setEditing(entry)}
                  onBump={() => void bumpEpisode(entry)}
                />
              ) : (
                <WatchlistRow
                  key={entry.id}
                  entry={entry}
                  titleLanguage={titleLanguage}
                  busy={busyIds.has(entry.animeId)}
                  selectMode={selectMode}
                  selected={selected.has(entry.animeId)}
                  onToggleSelect={() => toggleSelected(entry.animeId)}
                  onEdit={() => setEditing(entry)}
                  onBump={() => void bumpEpisode(entry)}
                />
              ),
            )}
          </div>
        ) : (
          <div className="empty-state">
            <h1>No titles in this list</h1>
            <p>
              {query
                ? "No titles match your search."
                : "Use the save button on an anime page to add titles here."}
            </p>
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

type CardProps = {
  entry: LibraryEntry;
  titleLanguage: ReturnType<typeof useTitleLanguage>;
  busy: boolean;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onBump: () => void;
};

function NextAiringPill({ entry }: { entry: LibraryEntry }) {
  const next = entry.anime.nextAiringEpisode;
  if (!next || entry.anime.status !== "RELEASING") return null;
  return (
    <span className="watchlist-next-airing" title="Next episode">
      <Clock size={11} aria-hidden />
      EP {next.episode} · {formatCountdownSeconds(next.timeUntilAiring)}
    </span>
  );
}

function ProgressMeta({ entry }: { entry: LibraryEntry }) {
  const ceiling = episodeCeiling(entry);
  const total = entry.anime.episodes ?? ceiling;
  const behind = episodesBehind(entry);
  const pct =
    ceiling && ceiling > 0
      ? Math.min(100, Math.round((entry.progress / ceiling) * 100))
      : 0;

  return (
    <>
      <span className="watchlist-progress-row">
        <span className="watchlist-progress-label">
          {entry.progress} / {total ?? "?"}
        </span>
        {behind != null && behind > 0 ? (
          <span className="watchlist-behind">{behind} behind</span>
        ) : null}
      </span>
      {pct > 0 ? (
        <span className="watchlist-card-progress" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </span>
      ) : null}
    </>
  );
}

function canBump(entry: LibraryEntry): boolean {
  if (entry.status === "completed" || entry.status === "dropped") return false;
  const ceiling = episodeCeiling(entry);
  return ceiling == null || entry.progress < ceiling;
}

function canResume(entry: LibraryEntry): boolean {
  return entry.status === "watching" || entry.status === "rewatching";
}

function WatchlistGridCard({
  entry,
  titleLanguage,
  busy,
  selectMode,
  selected,
  onToggleSelect,
  onEdit,
  onBump,
}: CardProps) {
  const router = useRouter();

  function stop(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  const handleCardClick = (event: React.MouseEvent) => {
    if (selectMode) {
      stop(event);
      onToggleSelect();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.button === 1) {
      window.open(`/anime/${entry.animeId}`, "_blank");
      return;
    }
    router.push(`/anime/${entry.animeId}`);
  };

  return (
    <div
      className={`anime-card watchlist-grid-card${selected ? " is-selected" : ""}`}
      onClick={handleCardClick}
      style={{ cursor: "pointer" }}
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
          <span className="poster-fallback">MiruCast</span>
        )}
        <LibraryStatusChip status={entry.status} />

        {selectMode ? (
          <span
            className={`watchlist-select-check${selected ? " is-checked" : ""}`}
            aria-hidden
          >
            {selected ? <Check size={16} /> : null}
          </span>
        ) : (
          <span className="watchlist-grid-card-controls">
            {canResume(entry) ? (
              <Link
                href={buildWatchHref({
                  animeId: entry.animeId,
                  episode: resumeEpisode(entry),
                })}
                className="watchlist-card-icon-btn"
                aria-label="Resume"
                title="Resume"
                onClick={(event) => event.stopPropagation()}
              >
                <Play size={15} />
              </Link>
            ) : null}
            {canBump(entry) ? (
              <button
                type="button"
                className="watchlist-card-icon-btn"
                aria-label="Add one episode"
                title="+1 episode"
                disabled={busy}
                onClick={(event) => {
                  stop(event);
                  onBump();
                }}
              >
                <Plus size={15} />
              </button>
            ) : null}
            <button
              type="button"
              className="watchlist-card-icon-btn"
              aria-label="Edit list entry"
              title="Edit"
              onClick={(event) => {
                stop(event);
                onEdit();
              }}
            >
              <Pencil size={15} />
            </button>
          </span>
        )}
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
            <Radio size={14} className="anime-card-airing-icon" aria-hidden />
          )}
          {getDisplayTitle(entry.anime.title, titleLanguage)}
        </span>
        <span className="anime-card-stats">
          {entry.score > 0 ? (
            <span title="Your score" className="watchlist-my-score">
              <Star size={12} aria-hidden />
              {scoreLabel(entry.score)}
            </span>
          ) : (
            <span title="Average score">
              <Star size={12} aria-hidden />
              {scoreLabel(entry.anime.averageScore)}
            </span>
          )}
          {entry.anime.airingCount != null ? (
            <span title="Aired/Sub">
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
        <WatchedProgress entry={entry} />
        <NextAiringPill entry={entry} />
      </span>
    </div>
  );
}

// Watched / total episode line + fill bar (grid view body). Total is the
// planned full run from AniList; "?" when AniList doesn't report it, in which
// case there is no whole to draw a bar (or count episodes left) against. When
// the total is known the track always renders, so untouched entries read as an
// empty bar rather than a blank gap.
function WatchedProgress({ entry }: { entry: LibraryEntry }) {
  const total = entry.anime.episodes ?? null;
  const pct =
    total && total > 0
      ? Math.min(100, Math.round((entry.progress / total) * 100))
      : 0;
  const aside =
    total && total > 0
      ? entry.progress >= total
        ? "done"
        : `${total - entry.progress} left`
      : null;
  return (
    <span className="watchlist-watched">
      <span className="watchlist-watched-label">
        <span>
          {entry.progress} / {total ?? "?"}
        </span>
        {aside === "done" ? (
          <span className="watchlist-watched-aside is-done">
            <Check size={11} aria-hidden />
            done
          </span>
        ) : aside ? (
          <span className="watchlist-watched-aside">{aside}</span>
        ) : null}
      </span>
      {total && total > 0 ? (
        <span className="watchlist-card-progress" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </span>
      ) : null}
    </span>
  );
}

function WatchlistRow({
  entry,
  titleLanguage,
  busy,
  selectMode,
  selected,
  onToggleSelect,
  onEdit,
  onBump,
}: CardProps) {
  const router = useRouter();

  function stop(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  const handleCardClick = (event: React.MouseEvent) => {
    if (selectMode) {
      stop(event);
      onToggleSelect();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.button === 1) {
      window.open(`/anime/${entry.animeId}`, "_blank");
      return;
    }
    router.push(`/anime/${entry.animeId}`);
  };

  return (
    <div
      className={`watchlist-row${selected ? " is-selected" : ""}`}
      onClick={handleCardClick}
      style={{ cursor: "pointer" }}
    >
      {selectMode ? (
        <span
          className={`watchlist-row-check${selected ? " is-checked" : ""}`}
          aria-hidden
        >
          {selected ? <Check size={14} /> : null}
        </span>
      ) : null}

      <span className="watchlist-row-poster">
        {entry.anime.coverImage ? (
          <Image
            src={entry.anime.coverImage}
            alt=""
            fill
            sizes="56px"
            className="poster-image"
          />
        ) : null}
      </span>

      <span className="watchlist-row-main">
        <span className="watchlist-row-title">
          {getDisplayTitle(entry.anime.title, titleLanguage)}
        </span>
        <span className="watchlist-row-sub">
          <LibraryStatusChip status={entry.status} />
          <span>
            {entry.anime.format === "TV" ? "TV" : entry.anime.format || "Anime"}
          </span>
          {entry.anime.seasonYear ? <span>{entry.anime.seasonYear}</span> : null}
          <NextAiringPill entry={entry} />
        </span>
      </span>

      <span className="watchlist-row-progress">
        <ProgressMeta entry={entry} />
      </span>

      <span className="watchlist-row-score" title="Your score">
        <Star size={13} aria-hidden />
        {entry.score > 0 ? scoreLabel(entry.score) : "-"}
      </span>

      {!selectMode ? (
        <span className="watchlist-row-actions">
          {canResume(entry) ? (
            <Link
              href={buildWatchHref({
                animeId: entry.animeId,
                episode: resumeEpisode(entry),
              })}
              className="watchlist-card-icon-btn"
              aria-label="Resume"
              title="Resume"
              onClick={(event) => event.stopPropagation()}
            >
              <Play size={15} />
            </Link>
          ) : null}
          {canBump(entry) ? (
            <button
              type="button"
              className="watchlist-card-icon-btn"
              aria-label="Add one episode"
              title="+1 episode"
              disabled={busy}
              onClick={(event) => {
                stop(event);
                onBump();
              }}
            >
              <Plus size={15} />
            </button>
          ) : null}
          <button
            type="button"
            className="watchlist-card-icon-btn"
            aria-label="Edit list entry"
            title="Edit"
            onClick={(event) => {
              stop(event);
              onEdit();
            }}
          >
            <Pencil size={15} />
          </button>
        </span>
      ) : null}
    </div>
  );
}
