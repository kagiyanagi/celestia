"use client";

import { useMemo } from "react";

import { AnimeCard } from "@/components/anime-card";
import { useAuth } from "@/components/auth-provider";
import { useDubCounts } from "@/components/dub-badge-provider";
import {
  getListFilterLabel,
  isLibraryStatusFilter,
  splitListFilter,
} from "@/lib/browse-filters";
import { getDisplayTitle } from "@/lib/format";
import type { LibraryEntry } from "@/types/account";
import type { AnimeSummary, BrowseFilters } from "@/types/anime";

export type BrowseView = "grid" | "list";

function matchesFilters(anime: AnimeSummary, filters: BrowseFilters): boolean {
  const query = filters.q.trim().toLowerCase();

  if (query) {
    const haystack = [
      anime.title?.english,
      anime.title?.romaji,
      anime.title?.native,
      anime.title?.userPreferred,
      getDisplayTitle(anime.title),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!haystack.includes(query)) {
      return false;
    }
  }

  const genres = anime.genres || [];
  const includeGenres = splitListFilter(filters.genre);
  if (includeGenres.length && !includeGenres.every((g) => genres.includes(g))) {
    return false;
  }
  const excludeGenres = splitListFilter(filters.genreExclude);
  if (excludeGenres.length && excludeGenres.some((g) => genres.includes(g))) {
    return false;
  }

  if (filters.format && anime.format !== filters.format) {
    return false;
  }

  const year = anime.seasonYear || anime.startDate?.year || 0;
  if (filters.yearMin && (!year || year < Number(filters.yearMin))) {
    return false;
  }
  if (filters.yearMax && (!year || year > Number(filters.yearMax))) {
    return false;
  }

  if (filters.season && anime.season !== filters.season) {
    return false;
  }

  if (filters.status && anime.status !== filters.status) {
    return false;
  }

  if (filters.source && anime.source !== filters.source) {
    return false;
  }

  if (filters.scoreMin && (anime.averageScore ?? 0) < Number(filters.scoreMin)) {
    return false;
  }

  const episodes = anime.episodes || 0;
  if (filters.episodesMin && (!episodes || episodes < Number(filters.episodesMin))) {
    return false;
  }
  if (filters.episodesMax && (!episodes || episodes > Number(filters.episodesMax))) {
    return false;
  }

  return true;
}

function sortLibraryItems(
  items: AnimeSummary[],
  sort: string,
  sortOrder: string,
): AnimeSummary[] {
  const sorted = [...items];
  const direction = sortOrder === "asc" ? 1 : -1;

  switch (sort) {
    case "score":
      return sorted.sort(
        (a, b) => ((a.averageScore || 0) - (b.averageScore || 0)) * direction,
      );
    case "release_date":
      return sorted.sort(
        (a, b) => ((a.seasonYear || 0) - (b.seasonYear || 0)) * direction,
      );
    case "favourites":
      return sorted.sort(
        (a, b) => ((a.favourites || 0) - (b.favourites || 0)) * direction,
      );
    case "trending":
      return sorted.sort(
        (a, b) => ((a.trending || 0) - (b.trending || 0)) * direction,
      );
    case "episodes":
      return sorted.sort(
        (a, b) => ((a.episodes || 0) - (b.episodes || 0)) * direction,
      );
    case "title":
      return sorted.sort(
        (a, b) =>
          getDisplayTitle(a.title).localeCompare(getDisplayTitle(b.title)) *
          direction,
      );
    case "popularity":
    default:
      return sorted.sort(
        (a, b) => ((a.popularity || 0) - (b.popularity || 0)) * direction,
      );
  }
}

function filterLibraryEntries(
  entries: LibraryEntry[],
  filters: BrowseFilters,
): LibraryEntry[] {
  if (!isLibraryStatusFilter(filters.list)) {
    return entries;
  }

  return entries.filter((entry) => entry.status === filters.list);
}

/**
 * Browse results with the viewer-relative "Your list" filter applied
 * client-side. Library views source directly from the viewer's library (the
 * catalog API knows nothing about it), with the other filters applied locally;
 * "Not in your list" hides saved titles from the catalog page. The "dubbed
 * only" filter is also client-side, reading hydrated dub badge counts.
 */
export function BrowseResultsGrid({
  items,
  filters,
  view = "grid",
}: {
  items: AnimeSummary[];
  filters: BrowseFilters;
  view?: BrowseView;
}) {
  const { user } = useAuth();
  const libraryEntries = user?.libraryEntries || [];
  const libraryIds = new Set(libraryEntries.map((entry) => entry.animeId));
  const isLibraryView =
    filters.list === "in" || isLibraryStatusFilter(filters.list);

  // Deduplicate input items by anime ID to avoid React key collisions during infinite scrolls
  const uniqueItems = useMemo(() => {
    const seen = new Set<number>();
    return items.filter((item) => {
      if (!item || typeof item.id !== "number") return false;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [items]);

  let base: AnimeSummary[];
  let note: string | null = null;

  if (isLibraryView) {
    const selectedEntries = filterLibraryEntries(libraryEntries, filters);
    const matched = selectedEntries
      .map((entry) => entry.anime)
      .filter((anime) => matchesFilters(anime, filters));
    // Deduplicate library matches by anime ID just in case
    const seen = new Set<number>();
    const uniqueMatched = matched.filter((anime) => {
      if (!anime || typeof anime.id !== "number") return false;
      if (seen.has(anime.id)) return false;
      seen.add(anime.id);
      return true;
    });
    base = sortLibraryItems(uniqueMatched, filters.sort, filters.sortOrder);
    const listLabel =
      filters.list === "in"
        ? "saved"
        : getListFilterLabel(filters.list).toLowerCase();
    note = `Showing ${base.length} of your ${selectedEntries.length} ${listLabel} titles.`;
  } else if (filters.list === "out") {
    base = uniqueItems.filter((anime) => !libraryIds.has(anime.id));
    if (base.length !== uniqueItems.length) {
      note = `Showing ${base.length} of ${uniqueItems.length} titles on this page not yet on your list.`;
    }
  } else {
    base = uniqueItems;
  }

  const dubbedOnly = filters.dubbed === "1";
  const dubCounts = useDubCounts(
    useMemo(() => (dubbedOnly ? base.map((anime) => anime.id) : []), [
      dubbedOnly,
      base,
    ]),
  );

  let visible = base;
  if (dubbedOnly) {
    visible = base.filter((anime) => (dubCounts.get(anime.id) ?? 0) > 0);
    note = `Dubbed only - ${visible.length} of ${base.length} on this page (dub data loads as you browse).`;
  }

  if (!visible.length) {
    return (
      <div className="empty-panel">
        {dubbedOnly
          ? "No dubbed titles found on this page yet - try the next page."
          : isLibraryView
            ? "Nothing in this list matches these filters."
            : filters.list === "out"
              ? "No titles on this page match your list filter. Try the next page."
              : "No titles found for this page."}
      </div>
    );
  }

  return (
    <>
      {note ? <p className="browse-list-note">{note}</p> : null}
      <div
        className={
          view === "list"
            ? "anime-list search-results"
            : "anime-grid search-results"
        }
      >
        {visible.map((anime) => (
          <AnimeCard anime={anime} key={anime.id} variant={view} />
        ))}
      </div>
    </>
  );
}
