"use client";

import { AnimeCard } from "@/components/anime-card";
import { useAuth } from "@/components/auth-provider";
import {
  getListFilterLabel,
  isLibraryStatusFilter,
} from "@/lib/browse-filters";
import { getDisplayTitle } from "@/lib/format";
import type { LibraryEntry } from "@/types/account";
import type { AnimeSummary, BrowseFilters } from "@/types/anime";

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

  if (filters.genre && !(anime.genres || []).includes(filters.genre)) {
    return false;
  }

  if (filters.format && anime.format !== filters.format) {
    return false;
  }

  if (filters.year && String(anime.seasonYear || "") !== filters.year) {
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
 * "Not in your list" hides saved titles from the catalog page.
 */
export function BrowseResultsGrid({
  items,
  filters,
}: {
  items: AnimeSummary[];
  filters: BrowseFilters;
}) {
  const { user } = useAuth();
  const libraryEntries = user?.libraryEntries || [];
  const libraryIds = new Set(libraryEntries.map((entry) => entry.animeId));
  const isLibraryView =
    filters.list === "in" || isLibraryStatusFilter(filters.list);

  let visible: AnimeSummary[];
  let note: string | null = null;

  if (isLibraryView) {
    const selectedEntries = filterLibraryEntries(libraryEntries, filters);
    const matched = selectedEntries
      .map((entry) => entry.anime)
      .filter((anime) => matchesFilters(anime, filters));
    visible = sortLibraryItems(matched, filters.sort, filters.sortOrder);
    const listLabel =
      filters.list === "in"
        ? "saved"
        : getListFilterLabel(filters.list).toLowerCase();
    note = `Showing ${visible.length} of your ${selectedEntries.length} ${listLabel} titles.`;
  } else if (filters.list === "out") {
    visible = items.filter((anime) => !libraryIds.has(anime.id));
    if (visible.length !== items.length) {
      note = `Showing ${visible.length} of ${items.length} titles on this page not yet on your list.`;
    }
  } else {
    visible = items;
  }

  if (!visible.length) {
    return (
      <div className="empty-panel">
        {isLibraryView
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
      <div className="anime-grid search-results">
        {visible.map((anime) => (
          <AnimeCard anime={anime} key={anime.id} />
        ))}
      </div>
    </>
  );
}
