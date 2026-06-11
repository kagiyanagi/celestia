# MiruCast Architecture

## Overview

MiruCast is built around a strict **provider boundary**: no external API is ever called from a page or UI component. All integrations live in `src/lib/providers/` and return app-owned types from `src/types/`. This makes the UI resilient — a provider failure degrades gracefully without crashing unrelated pages.

---

## Provider Strategy

Each provider is one file in `src/lib/providers/`. Responsibilities:

| Provider | File | Role |
|---|---|---|
| AniList | `anilist.ts` + `transformers/anilist.ts` | Primary catalog, tracking, airing, search |
| AniZip | `anizip.ts` | Per-episode metadata, cross-platform ID mappings |
| Jikan | `jikan.ts` | MAL rating comparison, episode flags |
| TMDB | `tmdb.ts` | Banner backdrop fallback only (not episode stills) |
| Kitsu | `kitsu.ts` | Episode still gap-filler for long-running series |
| AnimeSchedule | `anime-schedule.ts` | Sub airing times, dub premiere data |
| MyDubList | `dub-status.ts` | Dub coverage dataset (MAL-id-keyed, CC BY 4.0) |
| Streaming | `streaming.ts` | Multi-provider playback orchestration |
| Episode Metadata | `episode-metadata.ts` | Merged episode list (AniList + AniZip + Kitsu) |
| Franchise | `franchise.ts` | Relation graph (BFS + dagre layout) |
| Banner | `banner.ts` | Banner fallback chain (AniList → AniZip → TMDB) |

---

## Data Flow

```
Page (server component)
  └─ calls provider function in src/lib/providers/
       └─ calls fetchJson in src/lib/http/client.ts
            └─ external API (AniList, AniZip, etc.)
       └─ transforms raw response → app-owned type (src/types/)
  └─ passes normalized type to client island component
```

UI components consume only `src/types/` shapes. Provider internals are never exposed downstream.

---

## Storage

`src/lib/db.ts` exposes a `Store` interface with two implementations selected at runtime:

- **Postgres** (when `DATABASE_URL` is set) — production. Normalized schema:
  - `users` — slim profile, preferences, auth row (no tracking data)
  - `sessions` — session id and metadata
  - `library_entries` — one row per user+anime (status, progress, score, notes, dates, `aniListEntryId`)
  - `history_entries` — one row per user+anime+episode, capped per user
  - `stream_mappings` — verified provider id mappings with 30-day TTL
- **JSON file** (`data/app-db.json`) — development fallback. Same logical shape; not suitable for production (not durable on serverless).

Tracking data is never stored on the user row. The hot `getSessionUser()` auth path returns the slim `SessionUser` and transfers no tracking data.

---

## Auth & Sessions

`src/lib/auth.ts` owns:
- Cookie sessions (`mirucast_session`)
- scrypt password hashing
- Guest account creation
- Device tracking

Session reads return a `SessionUser` — a slim, redacted view with no library or history. The full `PublicUser` (slim user + library + history) is assembled only for client bootstrap and mutation responses.

OAuth tokens (AniList) are encrypted at rest with AES-256-GCM via `src/lib/crypto.ts`, keyed off `APP_SECRET`.

---

## Tracking & Sync

Library and history live in their own normalized tables, not on the user row. Every write is a scoped single-row operation through `account-store.ts`.

**AniList sync is two-way:**

- **Push:** local library writes and episode records also write to AniList when the user has a linked token.
- **Pull:** `syncAniListLibrary` fetches the remote library and merges with `mergeAniListPull` on a 60-second TTL. A failed pull is silently swallowed.
- **Conflict resolution:** newest `updatedAt` wins. Local-only entries are preserved. Removals on AniList are not mirrored locally.

**Merge semantics:**
- `mergeLibraryEntries` — incoming always wins. Used for initial AniList connect and XML imports.
- `mergeAniListPull` — newest-`updatedAt`-wins. Used for routine sync pulls.
- `mergeAniListHistory` — AniList activity is re-derived from the current feed each sync (old `anilist-` prefixed entries replaced). Native MiruCast watches (UUID ids) are always kept.

---

## Streaming

Streaming is **outside the core domain model**. Rules:

1. Playback data is fetched only when the user opens the watch page.
2. All other pages stay fully functional if a provider fails.
3. The app never restreams — iframes only, no proxy.
4. A wrong stream match is considered worse than no match. `findProviderAvailability` only serves count-verified matches.

**Adapter kinds** (selected by `STREAMING_PROVIDER_KIND`):

- `search` (default) — title-guessed lookup with episode-count alignment scoring. Verified matches are cached in `stream_mappings` with a 30-day TTL.
- `embed` — deterministic AniList-id-keyed URL template. No title guessing, no verification needed, no wrong-season risk.

Multi-server configuration via `STREAMING_PROVIDERS` JSON array, tried in ascending `priority` order.

---

## Notifications

Notifications are **derived on demand** from the user's tracked library — never stored. `src/lib/notifications.ts` fans out AniList airing lookups and AnimeSchedule dub data under `withSoftTimeout`, bounded for large libraries. Read state is a single `notificationsLastReadAt` timestamp on the user. "Mark all read" is one write.

---

## Rate Limiting

`src/lib/rate-limit.ts` is an in-memory sliding-window limiter. It is per-serverless-instance, making it a floor rather than a global guarantee. Apply to abuse-prone routes (auth, search). Swap the backing map for Redis when horizontal accuracy is required.

---

## Sync Rules (Conflict Philosophy)

AniList is the primary modern tracking source. Conflicts between local progress and AniList progress are resolved by `updatedAt` (newest wins), not silently overwritten. Local-only entries are preserved. The UI should surface ambiguous states explicitly when relevant, never hide them.

---

## Accuracy Rule

The product never fabricates data it cannot verify. Unverifiable values render as "unknown" or are hidden entirely. This is a hard rule applied throughout: dub status, episode counts, days watched, stream availability, and airing dates are all held to this standard.
