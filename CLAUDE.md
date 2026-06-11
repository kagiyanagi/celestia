# CLAUDE.md

This file is the deep technical reference for the MiruCast codebase. It covers architecture, every provider, all conventions, streaming rules, auth and session flow, and storage modes. Read this before making changes to `src/lib/`, `src/app/api/`, or the type system.

## Project

MiruCast is an anime watching and tracking site built on Next.js 15 (App Router), React 19, and TypeScript strict mode. AniList is the primary metadata and tracking source. Streaming is routed through a swappable provider adapter and is treated as **replaceable, non-core infrastructure** — the rest of the app must stay fully functional if streaming goes down.

## Commands

```bash
pnpm install          # Sync deps from pnpm-lock.yaml (use --frozen-lockfile in CI)
pnpm dev              # Local dev server
pnpm build            # Production bundle
pnpm start            # Serve production build (Railway / long-lived Node)
pnpm lint             # ESLint: next/core-web-vitals + TypeScript rules
pnpm typecheck        # tsc --noEmit — run this before every commit
```

There is **no automated test suite**. The quality bar before any change: green `pnpm lint`, `pnpm typecheck`, and `pnpm build` — same three gates CI runs.

Import alias: `@/*` → `src/*`.

---

## Architecture

### Provider Boundary (the central pattern)

External APIs are **never called from pages or components**. Every integration lives in `src/lib/providers/` and exposes normalized functions that convert third-party response shapes into app-owned types from `src/types/`. UI depends only on `src/types/`, never on raw API fields.

When adding a field from an external API:
1. Add it to the relevant type in `src/types/`.
2. Normalize it in the provider (or its transformer in `providers/transformers/`).
3. Consume the normalized field in the UI.

Never reach into raw response shapes downstream of a provider.

### HTTP Client

All outbound provider requests go through `fetchJson` in `src/lib/http/client.ts`. It centralizes:
- Configurable timeouts
- Retry-with-backoff (honoring `Retry-After`)
- In-flight request deduplication
- A stale-response cache for graceful degradation
- The typed `ProviderFetchError`

Do not call `fetch` directly from a provider — route through `fetchJson` with a `provider` label and a `cacheKey`.

For optional enrichment that should not block a response, wrap the call in `withSoftTimeout` (`src/lib/async.ts`): it returns a fallback after the timeout but lets the original promise keep running, so the result lands in the provider cache and the next request gets full data instantly. Used by banner enrichment and notifications.

### Accuracy Over Fabrication (hard rule)

The product **never guesses data it cannot verify**. Unverifiable values render as "unknown" or are hidden — never as a confident `0` or an estimate. Concrete examples:

- Dub data is gated on `dubPremier` — no fabricated counts for shows with no dub.
- Episode counts (`airingCount`) are `null` when unknown, not `0`. Cards hide the stat rather than printing `0`.
- "Days Watched" is shown only from AniList's real `minutesWatched`, never estimated.
- A wrong stream match is considered worse than no match — `findProviderAvailability` only serves a count-verified match when an expected episode count is known.

Preserve this when touching metadata or stream logic.

---

## Providers

### AniList (`anilist.ts` + `transformers/anilist.ts`)

Primary GraphQL catalog and tracking source. Covers: trending, seasonal, search, details, characters, relations, recommendations, airing. The `transformers/anilist.ts` module converts raw GraphQL responses into `AnimeSummary`, `AnimeDetail`, and related types. Detail and discovery flows fan out from here.

### AniZip (`anizip.ts`)

Per-episode metadata and cross-platform ID mappings (MAL, TVDB, TMDB, Kitsu). Used by the episode-metadata orchestrator. TVDB stills from AniZip win for thumbnails — they are keyed by AniList episode number, making them season-correct.

### Jikan (`jikan.ts`)

MyAnimeList rating comparison and episode flags. Supplementary source.

### TMDB (`tmdb.ts`)

Banner-backdrop fallback **only** (`getTmdbBackdrop`), for titles where AniList and AniZip have no banner. TMDB is **not** used for per-episode stills — its absolute episode numbering would stamp an earlier season's images onto later seasons of a long-running show.

### Kitsu (`kitsu.ts`)

Episode-still gap-filler. TVDB (via AniZip) and AniList cover only part of a long-running show's stills. Kitsu fills the holes. It is reached via AniZip's per-AniList-entry `kitsu_id`, so its numbering aligns with the catalog entry. Pages are fetched in bounded parallel batches and stop one batch after stills run out (Kitsu backfills stills from the start of a series). Alignment is verified (overlapping air dates and titles) before any still is trusted. Kitsu only fills genuinely empty slots — existing TVDB/AniList stills always win.

### AnimeSchedule (`anime-schedule.ts`)

Sub airing times, plus dub data resolved by AniList id via `GET /anime?anilist-ids=` (ONE id per request — repeated or comma-separated params 404, and the bracket form is silently ignored; always verified against `websites.aniList`, never fuzzy title). Dub existence is gated on `dubPremier` — a missing value or the `0001-01-01` sentinel means **no dub**, so nothing is shown. Only covers ~2020+ simulcasts.

### MyDubList (`dub-status.ts`)

Fills AnimeSchedule's catalog gap with a daily-updated, multi-source dub dataset (MAL-id-keyed, high-confidence tier ≥3 sources). Boolean only (no per-episode count), used as a fallback: a FINISHED show with a complete English dub has every episode dubbed → dub count = episode total. The ~50 KB file is fetched once and memoized. **CC BY 4.0 — attribution required** (`MYDUBLIST_ATTRIBUTION`).

### Streaming (`streaming.ts` + `streaming-adapter.ts` / `streaming-embed-adapter.ts`)

Swappable playback adapter. Two adapter kinds:

- **`search`** (default, `streaming-adapter.ts`) — guesses provider anime IDs from title variants (`getTitleCandidates`), then scores each candidate against the expected episode count (`calculateAlignmentScore`). Counts that disagree beyond a threshold return `null` (rejected as a different season or franchise listing). Only episode-count-**verified** matches are persisted via `stream-mapping-store.ts`, so title guessing happens at most once per anime+provider. Mappings carry a 30-day TTL and a warm-instance memory cache.
- **`embed`** (`streaming-embed-adapter.ts`) — resolves deterministically by substituting the AniList id, episode, and audio into a deployer-supplied URL template (`{id}/{episode}/{audio}`). Keyed by the exact AniList id, so it skips title guessing and count verification. No wrong-season risk, and no episode list or count exposed — the watch page falls back to AniList metadata for those.

`getStreamSource` is the single entrypoint both the watch page (first render) and the `/api/watch/[id]/source` route call. The watch page swaps server, audio, and episode **in place** (client fetch to that route) rather than reloading: `watch-selection-context.tsx` holds the selection, `watch-player-panel.tsx` renders it, and `watch-href.ts` (`buildWatchHref`) is the single source of truth for `/watch/[id]` URLs.

### Episode Metadata (`episode-metadata.ts`)

Orchestrates AniList + AniZip (+ Kitsu) into a single merged episode list with per-field source attribution. AniZip's TVDB still wins for the thumbnail; AniList's `streamingEpisodes` keep the streaming `url`/`site`; Kitsu fills any still-less slots that remain (alignment-verified, gap-only). No TMDB stills.

### Franchise (`franchise.ts`)

Builds the franchise relation graph: BFS over AniList relations (bounded by `MAX_NODES` / `MAX_DEPTH`) laid out with `@dagrejs/dagre` into the `FranchiseGraph` shape consumed by the details page. Served from `/api/anime/[id]/franchise`.

### Banner (`banner.ts`)

Resolves a fallback banner when AniList has none: AniList → AniZip fanart → TMDB backdrop. `enrichSummaryBanners` fills missing banners across a list with bounded concurrency.

### Health (`index.ts`)

Aggregates per-provider health for `/api/health`.

---

## Storage (Dual-Mode)

`src/lib/db.ts` exposes a single `Store` interface via `getStore()`, with two implementations chosen at runtime:

- **Postgres** (when `DATABASE_URL` is set) — normalized tables: `users`, `sessions`, `stream_mappings`, `library_entries` (one row per user+anime), `history_entries` (one row per user+anime+episode, capped per user). Schema auto-created on first use, with one-time migrations from any legacy `app_state` blob.
- **JSON file** (`data/app-db.json`) — development fallback only. Mirrors the same shape; does **not** persist on serverless hosts, so production needs `DATABASE_URL`.

The split is deliberate: tracking data is **never** stored on the user row, so a tracking write touches a single entry row (not a multi-MB blob) and the hot auth read never transfers library/history data.

Higher-level domain stores wrap `getStore()`:
- `account-store.ts` — profile, library, history
- `stream-mapping-store.ts` — verified stream matches

---

## Tracking & Sync (Library + History)

Library and watch history are the durable product value. They live in **their own normalized tables** (`library_entries` / `history_entries`), one row per entry — not inline on the user record. Every tracking write goes through an `account-store.ts` helper that performs a **single scoped row write** (`upsertLibraryEntry`, `recordHistory`, …), never a whole-user rewrite.

A `LibraryEntry` carries: status (`planning` / `watching` / `on_hold` / `dropped` / `completed` / `rewatching`), score, progress, repeat count, notes, start/complete dates, `addedAt` (notification window anchor), and `aniListEntryId` (the link to its AniList list row).

**AniList sync is two-way:**

- **Push (write-through):** editing the library (`/api/library`) or recording an episode (`/api/history`) also calls `saveAniListLibraryEntry` when the user has a linked token. The returned AniList list-entry id is persisted as `aniListEntryId` so later writes target the exact remote row instead of creating duplicates.
- **Pull (read-back):** `syncAniListLibrary` (`anilist-sync.ts`) fetches the viewer's AniList library and profile then merges via `applyAniListSync`. Gated by `aniListSyncedAt` with a 60-second TTL (`{ force: true }` bypasses it). A failed pull is swallowed — sync must never break a page.
- **Conflict resolution:** newest-`updatedAt`-wins, where AniList's real edit time drives it (`mergeAniListPull`). Local-only entries (never on AniList) are preserved; removals on AniList are not mirrored. AniList watch activity is merged into MiruCast history (`mergeAniListHistory`), skipped entirely when `preferences.pauseHistory` is set.

**List import:** `mal-import.ts` parses MyAnimeList and AniList XML export formats into MAL-id-keyed entries. `/api/library/import` resolves those ids to AniList summaries and bulk-loads them through `importLibraryEntries` (size/entry-count guarded, malformed rows skipped). Import reuses the same newest-wins merge as sync, so it never clobbers newer local edits.

---

## Auth & Sessions

`src/lib/auth.ts` owns cookie sessions (`mirucast_session`), scrypt password hashing, guest accounts, and device tracking.

- `requireSessionUser()` / `getSessionUser()` gate API routes and return a **redacted, slim `SessionUser`** — no library, no history, never the raw `UserRecord` secrets.
- `getSessionPublicUser()` assembles the full `PublicUser` (slim user + library + history) for the client bootstrap.
- Session IDs are regenerated on privilege escalation (e.g. AniList OAuth link).
- Stored OAuth tokens are encrypted at rest by `src/lib/crypto.ts` (AES-256-GCM keyed off `APP_SECRET`; self-describing `enc:v1:` prefix; dev falls back to a machine-local secret).

**AniList OAuth flow:** `/api/anilist/connect` (sets the `mirucast_anilist_state` cookie, requires a session) → AniList authorize → `/api/anilist/callback` verifies state and exchanges the code. Token encrypted at rest, session regenerated on link.

---

## Config & Guardrails

Read configuration through `src/lib/env.ts`, not `process.env` directly, so misconfiguration fails in one place. `assertEnv()` warns in dev and **throws in production** for missing required vars (e.g. `APP_SECRET`).

The `/api/cron/cleanup` route purges stale guest accounts and is protected by `CRON_SECRET` (Vercel cron sends it as a bearer token automatically).

---

## Notifications (Derived, Never Stored)

`src/lib/notifications.ts` builds new-release notices on demand from the user's tracked library — subbed episode drops (AniList airing) and dub drops (AnimeSchedule) within a recent window. Notifications are **never persisted**. Read state is a single `notificationsLastReadAt` timestamp on the user, so "mark all read" is one write and each notice's `read` flag is derived by comparing its `airedAt`. Like the rest of the app, it fabricates nothing — only episodes a provider reports as aired appear.

---

## Discovery & Browse Filters

The discovery pages (`/trending`, `/airing`, `/finished`, `/movies`, `/upcoming`, `/watchlist`, `/search`) are thin shells over one shared parser: `src/lib/browse-filters.ts`. `parseBrowseParams(searchParams)` turns URL query params into a typed `{ filters, page }`. UI never assembles AniList query args by hand — it produces `BrowseFilters`, which the AniList provider consumes. Add new filterable dimensions here (option list + parse + href builder), not in individual pages.

---

## Rate Limiting

`src/lib/rate-limit.ts` is an in-memory sliding-window limiter, **per serverless instance** (a floor, not a global guarantee — swap the backing map for Redis if horizontal accuracy is needed). Route handlers guard with `await rateLimitResponse(scope, { limit, windowMs })`, which returns a ready `429` Response (with `Retry-After`) or `null` to proceed. Applied to abuse-prone routes: auth (`login`, `signup`, `guest`) and `search`.

---

## API Routes

Under `src/app/api/`. They authenticate with `requireSessionUser()`, delegate to a domain store or provider, and return app types. Keep route handlers thin and push logic into `src/lib`.

---

## Page Composition (Server Shell → Client Island)

Route pages are thin server components that fetch via providers (e.g. `src/app/page.tsx` calls `getHomeCollections`), then hand data to a co-located client island for interactivity. The pattern is visible across every top-level route (`home-page-client.tsx`, `watchlist-page-client.tsx`, `*-page-shell.tsx`). Keep new pages on the same split — data fetching in the server route file, interactivity in the island — instead of marking the route itself `"use client"`.

---

## Global Providers

`src/app/layout.tsx` wraps the tree in `ToastProvider > AuthProvider > DubBadgeProvider > BannerFallbackProvider`, in that order. New global contexts slot into this stack; pick the position based on which other contexts they need to read from.

---

## Conventions

### Naming
- **Kebab-case filenames**: `home-hero-carousel.tsx`, `watch/[id]/page.tsx`. One PascalCase exception: the `AnimeDetailsShell/` component directory.
- **2-space indentation, double quotes** throughout.

### Styling
- No Tailwind, no CSS modules — plain global CSS with CSS custom properties.
- `globals.css` defines design tokens (`--bg`, `--panel`, `--line`, `--text`, `--radius`, easing curves, the Manrope font).
- `polish.css` is the monochrome design layer imported **after** `globals.css` in `layout.tsx` — order matters.
- Style against variables, never hardcode colors.

### Display Formatting
User-facing strings go through `src/lib/format.ts` (`getDisplayTitle`, `formatAnimeDate`, relative-time helpers) so titles, dates, and durations render consistently and handle the "unknown" cases.

### Image Hosts
`next/image` rejects any remote host not listed in `images.remotePatterns` in `next.config.ts`. When adding a new image source — especially a streaming provider's thumbnail hostname — register it there or images will silently fail.

---

## Key Files Quick Reference

| File | What it does |
|---|---|
| `src/lib/providers/anilist.ts` | All AniList GraphQL queries and response normalization |
| `src/lib/providers/streaming.ts` | Multi-provider stream orchestration, title scoring, mapping persistence |
| `src/lib/providers/episode-metadata.ts` | Merged episode list from AniList + AniZip + Kitsu |
| `src/lib/db.ts` | Dual-mode Store interface (Postgres + JSON) |
| `src/lib/account-store.ts` | All library, history, and user record mutations |
| `src/lib/auth.ts` | Session management, hashing, OAuth flow |
| `src/lib/anilist-sync.ts` | AniList pull sync (60s TTL, best-effort) |
| `src/lib/notifications.ts` | Derived-on-demand release notifications |
| `src/lib/browse-filters.ts` | Shared browse page filter parser |
| `src/lib/rate-limit.ts` | Sliding-window rate limiter |
| `src/lib/http/client.ts` | Shared HTTP client for all outbound provider requests |
| `src/lib/env.ts` | Typed config access — read all vars here |
| `src/lib/format.ts` | User-facing string formatting |
| `src/lib/watch-href.ts` | Single source of truth for `/watch/[id]` URL construction |
| `src/app/globals.css` | Design tokens and base layout |
| `src/app/polish.css` | Monochrome design layer |
| `next.config.ts` | Image host allowlist, security headers, allowed dev origins |
