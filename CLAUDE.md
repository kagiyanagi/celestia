# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Celestia is an anime watching and tracking site built on the Next.js App Router (Next 16, React 19, TypeScript strict mode). AniList is the primary metadata/tracking source; streaming is routed through a swappable provider adapter and is treated as replaceable, non-core infrastructure.

## Commands

```bash
pnpm install          # sync deps from pnpm-lock.yaml (use --frozen-lockfile in CI)
pnpm dev              # local dev server
pnpm build            # production build
pnpm start            # serve a production build (Railway / long-lived Node)
pnpm lint             # eslint . (next core-web-vitals + typescript rules)
pnpm typecheck        # tsc --noEmit
```

There is **no automated test suite**. The bar before any change is green `pnpm lint`, `pnpm typecheck`, and `pnpm build` — the same three gates CI runs on `main` and PRs. Run `pnpm typecheck` specifically to catch contract drift between provider modules, pages, and `src/types`.

Import alias: `@/*` → `src/*`.

## Architecture

### Provider boundary (the central pattern)
External APIs are never called from pages or components. Every integration lives in `src/lib/providers/` and exposes **normalized** functions that convert third-party shapes into app-owned types from `src/types`. UI depends only on `src/types`, never on raw AniList / streaming-provider fields. When adding a field, normalize it in the provider (or its transformer) — do not reach into raw response shapes downstream.

Providers:
- **AniList** (`anilist.ts` + `transformers/anilist.ts`) — primary GraphQL catalog: trending, seasonal, search, details, characters, relations, recommendations, airing. Detail/discovery flows fan out from here.
- **AniZip** (`anizip.ts`) — per-episode metadata and cross-platform ID mappings (MAL, TVDB, TMDB, Kitsu).
- **Jikan** (`jikan.ts`) — MyAnimeList rating comparison and episode flags.
- **TMDB** (`tmdb.ts`) — banner-backdrop fallback only (`getTmdbBackdrop`), for titles AniList and ani.zip have no banner for. It is deliberately **not** used for per-episode stills (see episode-metadata below).
- **AnimeSchedule** (`anime-schedule.ts`) — sub airing times, plus dub data resolved by AniList id via `GET /anime?anilist-ids=` (ONE id per request — repeated/comma params 404 and the bracket form is silently ignored; verified against `websites.aniList`, never fuzzy title). Dub existence is gated on `dubPremier` — a missing value or the `0001-01-01` sentinel means **no dub**, so nothing is shown. Sub/dub _timetable_ endpoints feed the precise next-episode date, matched by the record's slug. Only covers ~2020+ simulcasts.
- **MyDubList** (`dub-status.ts`) — fills AnimeSchedule's catalog gap with a daily-updated, multi-source dub dataset (MAL-id-keyed, high-confidence tier ≥3 sources). Boolean only (no per-episode count), so it's used as a fallback: a FINISHED show with a complete English dub has every episode dubbed → dub count = episode total. The ~50KB file is fetched once and memoized. **CC BY 4.0 — attribution required** (`MYDUBLIST_ATTRIBUTION`).
- **Streaming** (`streaming.ts` + `streaming-adapter.ts`) — swappable playback adapter (see below).
- `episode-metadata.ts` orchestrates AniList + AniZip into a single merged episode list with per-field source attribution. **ani.zip's TVDB still wins for the thumbnail** (it is keyed by AniList episode number and is therefore season-correct); AniList's `streamingEpisodes` keep the streaming `url`/`site`. No TMDB stills — TMDB's absolute episode numbering would stamp an earlier season's images onto later seasons.
- `franchise.ts` builds the franchise relation graph: BFS over AniList relations (bounded by `MAX_NODES`/`MAX_DEPTH`) laid out with `@dagrejs/dagre` into the `FranchiseGraph` shape consumed by the details page; served from `/api/anime/[id]/franchise`.
- `banner.ts` resolves a fallback banner when AniList has none, walking AniList → ani.zip fanart → TMDB backdrop; `enrichSummaryBanners` fills missing banners across a list with bounded concurrency.
- `index.ts` aggregates per-provider health for `/api/health`.

### HTTP client
All outbound provider requests go through `fetchJson` in `src/lib/http/client.ts`. It centralizes timeouts, retry-with-backoff (honoring `Retry-After`), in-flight request dedup, a stale-response cache for graceful degradation, and the typed `ProviderFetchError`. Don't call `fetch` directly from a provider — route through `fetchJson` with a `provider` label and a `cacheKey`.

For optional enrichment that shouldn't block a response, wrap the call in `withSoftTimeout` (`src/lib/async.ts`): it returns a fallback after the timeout but lets the original promise keep running, so the result still lands in the provider cache and the next request gets full data instantly. Used by banner enrichment and notifications.

### Accuracy over fabrication (hard rule)
The product never guesses data it cannot verify, and unverifiable values render as "unknown"/hidden, never as a confident `0` or an estimate. This is enforced concretely throughout: dub data is gated on `dubPremier` (no fabricated counts/countdowns for shows with no dub); episode counts (`airingCount`) are `null` when unknown rather than `0`, and the cards/grids hide the stat instead of printing `0`; episode rows are never synthesized past what's verified (only finished shows pad to their full count); "Days Watched" is shown only from AniList's real `minutesWatched`, never from an assumed 24-min episode length. For streaming, a wrong match is considered worse than no match — `findProviderAvailability` only serves a count-verified match when an expected episode count is known (see scoring below). Preserve this when touching metadata or stream logic.

### Streaming (replaceable, demand-only)
Streaming must stay outside the core domain model. Playback data is requested only when the user opens the watch page; the rest of the app stays fully functional if a provider fails (fail closed with a clear message). Configure via `STREAMING_PROVIDER_*` (single) or `STREAMING_PROVIDERS` JSON (multi-server, tried by ascending `priority`).

`streaming.ts` guesses provider anime IDs from title variants (`getTitleCandidates`), then scores each candidate against the expected episode count (`calculateAlignmentScore`). Counts that disagree beyond a threshold return `null` (rejected as a different season/franchise listing). Only episode-count-**verified** matches are persisted via `stream-mapping-store.ts`, so title guessing happens at most once per anime+provider; mappings carry a 30-day TTL and a warm-instance memory cache.

### Storage (dual-mode)
`src/lib/db.ts` exposes a single `Store` interface via `getStore()`, with two implementations chosen at runtime:
- **Postgres** (when `DATABASE_URL` is set) — one row per entity (`users`, `sessions`, `stream_mappings`), schema auto-created on first use, with a one-time migration from the legacy `app_state` blob.
- **JSON file** (`data/app-db.json`) — development fallback only. It does **not** persist on serverless hosts, so production needs `DATABASE_URL`.

Higher-level domain stores wrap `getStore()`: `account-store.ts` (profile, library, history), `stream-mapping-store.ts` (verified stream matches).

### Auth & sessions
`src/lib/auth.ts` owns cookie sessions (`celestia_session`), scrypt password hashing, guest accounts, and device tracking. `requireSessionUser()` / `getSessionUser()` gate API routes; they return a **redacted** `PublicUser` (never the raw `UserRecord` with secrets). Session IDs are regenerated on privilege escalation (e.g. AniList OAuth link). Stored OAuth tokens are encrypted at rest by `src/lib/crypto.ts` (AES-256-GCM keyed off `APP_SECRET`; self-describing `enc:v1:` prefix; dev falls back to a machine-local secret).

### Config & guardrails
Read configuration through `src/lib/env.ts`, not `process.env`, so misconfiguration fails in one place. `assertEnv()` warns in dev and **throws in production** for missing required vars (e.g. `APP_SECRET`). The `/api/cron/cleanup` route purges stale guests and is protected by `CRON_SECRET` (Vercel cron sends it as a bearer token automatically).

### Notifications (derived, not stored)
`src/lib/notifications.ts` builds new-release notices on demand from the user's tracked library — subbed episode drops (AniList airing) and dub drops (AnimeSchedule) within a recent window, fanned out under `withSoftTimeout` and bounded for large libraries. Notifications themselves are **never persisted**; read state is a single `notificationsLastReadAt` timestamp on the user (so "mark all read" is one write, and each notice's `read` flag is derived by comparing its `airedAt`). `/api/notifications` GET derives the list, POST marks read; the header bell and `/notifications` page render it. Like the rest of the app, it fabricates nothing — only episodes a provider reports as aired appear.

### Discovery & browse filters
The discovery pages (`/trending`, `/airing`, `/finished`, `/movies`, `/upcoming`, `/watchlist`, `/search`) are thin shells over one shared parser: `src/lib/browse-filters.ts`. `parseBrowseParams(searchParams)` turns URL query params into a typed `{ filters, page }`, the `*_OPTIONS` catalogs define the selectable genre/format/season/status/sort/etc. values, `getDefaultBrowseSort(section)` sets each section's default ordering, and `buildBrowseHref()` constructs filter links. UI never assembles AniList query args by hand — it produces `BrowseFilters`, which the AniList provider consumes. Add a new filterable dimension here (option list + parse + href), not in individual pages.

### Rate limiting
`src/lib/rate-limit.ts` is an in-memory sliding-window limiter, **per serverless instance** (a floor, not a global guarantee — swap the backing map for Redis if horizontal accuracy is needed). Route handlers guard with `await rateLimitResponse(scope, { limit, windowMs })`, which returns a ready `429` `Response` (with `Retry-After`) or `null` to proceed. Applied to the abuse-prone routes: auth (`login`, `signup`, `guest`) and `search`.

### API routes
Under `src/app/api/`. They authenticate with `requireSessionUser()`, delegate to a domain store/provider, and return app types — keep route handlers thin and push logic into `src/lib`.

## Conventions

Kebab-case file names (`home-hero-carousel.tsx`, `watch/[id]/page.tsx`); the one PascalCase exception is the `AnimeDetailsShell/` component directory. 2-space indent, double quotes, app-owned data shapes in `src/types`. See `AGENTS.md` for the full contributor guide and `docs/ARCHITECTURE.md` for provider strategy and the tracking/sync data model.
