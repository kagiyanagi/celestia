# Standardize Watchlist Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the visual style of anime cards on the `/watchlist` page with the standard `AnimeCard` used across the rest of the site (search, trending, etc.), while preserving the "edit" button.

**Architecture:** Refactor `WatchlistPageClient` to use standard CSS classes (`anime-grid`, `anime-card`) and internal structure (meta-top, stats, etc.). Move the status chip and edit button into the poster overlay.

**Tech Stack:** React, Next.js, Tailwind/Vanilla CSS, Lucide icons.

---

### Task 1: Update Watchlist Grid and Card Structure

**Files:**
- Modify: `src/components/watchlist-page-client.tsx`

- [x] **Step 1: Update imports**
  Add necessary icons and helpers.
  ```tsx
  import { Star, Captions, Radio } from "lucide-react";
  import { scoreLabel } from "@/lib/format";
  import { DubBadge } from "@/components/dub-badge";
  ```

- [x] **Step 2: Standardize the grid and card structure**
  Update the JSX to use `anime-grid` for the container and `anime-card` for the items, mirroring the standard layout.
  ```tsx
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
              sizes="240px"
              className="poster-image"
            />
          ) : (
            <span className="poster-fallback">Celestia</span>
          )}
          <LibraryStatusChip status={entry.status} />
          <span className="watchlist-grid-card-edit">
            <Pencil size={16} />
          </span>
        </span>

        <span className="anime-card-body">
          <span className="anime-card-meta-top">
            <span>{entry.anime.format === "TV" ? "TV Show" : entry.anime.format || "Anime"}</span>
            <span>{entry.anime.seasonYear || "Now"}</span>
          </span>
          <span className="anime-card-title">
            {entry.anime.status === "RELEASING" && (
              <Radio size={14} className="anime-card-airing-icon" aria-hidden />
            )}
            {getDisplayTitle(entry.anime.title)}
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
  ```

### Task 2: CSS Cleanup and Alignment

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Remove redundant watchlist styles**
  Remove specific styles that contradict the new standardized structure, especially those related to padding and positioning that are now handled by standard `anime-card` classes.

- [ ] **Step 2: Ensure the edit button remains functional and styled**
  Verify `.watchlist-grid-card-edit` still looks good as an overlay on the poster.

### Task 3: Verification

- [ ] **Step 1: Verify build and visual consistency**
  Run `npm run build` or equivalent to ensure no type errors.
  Confirm the `/watchlist` page now matches the search results grid visually.
