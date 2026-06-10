# Celestia

Celestia is an anime watching and tracking application built on the Next.js App Router. It treats **AniList as the source of truth** for metadata and library sync, and **streaming as interchangeable infrastructure** — you bring your own playback provider, and the rest of the app keeps working if it goes down.

> **No streaming source is bundled.** Celestia is a metadata, tracking, and discovery app. Video playback is entirely bring-your-own: configure your own provider API through the `STREAMING_PROVIDER_*` environment variables. No endpoint is included, referenced, or enabled by default. The maintainers do not host, provide, proxy, or endorse any streaming source.

## Why It Exists

Most anime trackers are either pure trackers (no watching) or pure streaming sites (no tracking). Celestia aims to close the gap: a personal watching dashboard where your library, watch history, AniList sync, and episode browsing all live in one place — with streaming remaining optional and pluggable.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript (strict) |
| Styling | Plain CSS with custom properties — no Tailwind, no CSS modules |
| Metadata | AniList GraphQL, AniZip, Jikan, TMDB, AnimeSchedule, Kitsu, MyDubList |
| Storage | Postgres (production) or JSON file (local dev) — dual-mode via `getStore()` |
| Auth | Cookie sessions, scrypt password hashing, AniList OAuth, guest accounts |
| Deployment | Vercel (serverless) or Railway (long-lived Node) |
| Package manager | pnpm |

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env.local
# Fill in at minimum ANILIST_CLIENT_ID and ANILIST_CLIENT_SECRET

# 3. Start the dev server
pnpm dev
```

Other commands:

```bash
pnpm lint        # ESLint (Next.js core-web-vitals + TypeScript rules)
pnpm typecheck   # tsc --noEmit — run before every commit
pnpm build       # Production bundle (the CI gate)
pnpm start       # Serve production build (Railway / long-lived Node)
```

## Environment Variables

Copy `.env.example` to `.env.local`. Required variables are marked.

| Variable | Required | Description |
|---|---|---|
| `ANILIST_GRAPHQL_ENDPOINT` | Yes | AniList GraphQL URL (`https://graphql.anilist.co`) |
| `ANILIST_CLIENT_ID` | Yes | AniList OAuth app client ID |
| `ANILIST_CLIENT_SECRET` | Yes | AniList OAuth app secret |
| `ANILIST_REDIRECT_URI` | Yes | OAuth callback (`http://localhost:3000/api/auth/callback/anilist`) |
| `NEXT_PUBLIC_APP_URL` | Yes | Public base URL of the app |
| `APP_SECRET` | Yes | Random 32-byte secret for session + token encryption |
| `DATABASE_URL` | No | Postgres connection string. Without it, data lives in `data/app-db.json` |
| `ANIMESCHEDULE_API_TOKEN` | No | Free token from animeschedule.net — enables airing times and dub data |
| `TMDB_API_KEY` | No | Free key from themoviedb.org — enables banner fallback images |
| `STREAMING_PROVIDER_URL` | No | Base URL of your streaming API (single provider) |
| `STREAMING_PROVIDER_LABEL` | No | Display name shown in the UI |
| `STREAMING_PROVIDER_ID` | No | Internal identifier for the provider |
| `STREAMING_PROVIDER_KIND` | No | `search` (default, title-based) or `embed` (AniList-id-keyed URL template) |
| `STREAMING_PROVIDERS` | No | JSON array for multi-server configuration (see `.env.example`) |
| `CRON_SECRET` | No | Bearer token for `/api/cron/cleanup` (Vercel cron sends it automatically) |

## Architecture Overview

Celestia is built around a strict **provider boundary**: external APIs are never called from pages or UI components. Every integration lives in `src/lib/providers/` and returns app-owned types from `src/types/`. UI components depend only on those normalized shapes.

Storage is **dual-mode**: a Postgres store (`DATABASE_URL` set) for production, and a local JSON file store for development — both implement the same `Store` interface from `src/lib/db.ts`.

AniList sync is **two-way**: pushing local edits up (write-through) and pulling remote edits back on a 60-second TTL.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full architecture and [`CLAUDE.md`](CLAUDE.md) for the deep provider-by-provider and pattern reference.

## Project Structure

```
src/
├── app/                  Next.js App Router: routes, API handlers, global CSS
│   ├── api/              All API route handlers (thin — logic lives in src/lib)
│   ├── anime/[id]/       Anime detail page
│   ├── watch/[id]/       Watch page (stream player + episode browser)
│   ├── watchlist/        User library browser
│   ├── history/          Watch history
│   ├── profile/          Public user profiles
│   ├── schedule/         Airing timetable
│   ├── notifications/    New-release notifications
│   ├── search/           Search page
│   ├── trending/         Trending anime browse
│   ├── airing/           Currently airing browse
│   ├── finished/         Finished series browse
│   ├── movies/           Movie browse
│   ├── upcoming/         Upcoming series browse
│   ├── missed-sequels/   Sequels the user hasn't added yet
│   ├── globals.css       Design tokens and base layout
│   └── polish.css        Monochrome design layer (imported after globals.css)
│
├── components/           Reusable UI components (server + client)
│   ├── AnimeDetailsShell/ Anime detail page composition (server entry + parts)
│   └── ...               All other components (kebab-case filenames)
│
├── lib/                  Domain logic and provider adapters
│   ├── providers/        One file per external API (normalize here, not in UI)
│   │   ├── anilist.ts    Primary metadata + tracking source
│   │   ├── streaming.ts  Stream-source orchestrator (multi-provider)
│   │   └── ...           AniZip, Kitsu, Jikan, TMDB, AnimeSchedule, etc.
│   ├── http/client.ts    Shared HTTP client (timeouts, retries, dedup, cache)
│   ├── db.ts             Dual-mode Store (Postgres + JSON)
│   ├── auth.ts           Sessions, hashing, guest accounts, device tracking
│   ├── account-store.ts  Library, history, and user record writes
│   ├── anilist-sync.ts   Two-way AniList sync orchestration
│   ├── notifications.ts  Derived-on-demand release notifications
│   ├── browse-filters.ts Shared filter parser for all browse pages
│   ├── rate-limit.ts     Sliding-window rate limiter
│   ├── env.ts            Typed config access (fail-fast on missing required vars)
│   └── format.ts         User-facing string formatting (titles, dates, durations)
│
└── types/                App-owned TypeScript types
    ├── anime.ts           Anime metadata shapes
    ├── account.ts         User, library, history, session types
    └── streaming.ts       Streaming provider and source types

docs/
└── ARCHITECTURE.md       Architecture decisions, data flow, sync and storage model

data/
└── app-db.json           Local dev JSON store (auto-created, gitignored in prod)
```

## Deployment

Celestia deploys to **Vercel** (serverless) or **Railway** (long-lived Node):

```bash
pnpm build   # Build the production bundle
pnpm start   # Start the Node server (Railway only)
```

Set all required environment variables in the platform dashboard. On Vercel, set `DATABASE_URL` to a Postgres connection string (Neon, Vercel Postgres, Supabase, etc.) — the JSON file store does not persist on serverless.

GitHub Actions runs `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` on every push to `main` and on pull requests.

## Further Reading

- [`CLAUDE.md`](CLAUDE.md) — deep technical reference for the codebase: every provider, pattern, and convention explained
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — architecture decisions, data flow, sync model, and streaming rules
- [`AGENTS.md`](AGENTS.md) — contributor guide for AI agents and human contributors alike
