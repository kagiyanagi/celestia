# MiruCast

MiruCast is an anime watching and tracking app built on the Next.js app router. it treats **AniList as the source of truth** for metadata and library sync, and **streaming as interchangeable infrastructure** you bring your own playback provider, and the rest of the app keeps working if it goes down.

> **no streaming source is bundled.** MiruCast is a metadata, tracking, and discovery app. video playback is entirely bring-your-own: configure your own provider API through the `STREAMING_PROVIDER_*` environment variables. no endpoint is included, referenced, or enabled by default. the maintainers do not host, provide, proxy, or endorse any streaming source.

## stack

| layer | technology |
|---|---|
| framework | Next.js 15 (app router), React 19, TypeScript (strict) |
| styling | plain CSS with custom properties, no Tailwind, no CSS modules |
| metadata | AniList GraphQL, AniZip, Jikan, TMDB, AnimeSchedule, Kitsu, MyDubList |
| storage | Postgres (production) or JSON file (local dev), dual-mode via `getStore()` |
| auth | cookie sessions, scrypt password hashing, AniList OAuth, guest accounts |
| deployment | Vercel (serverless) or Railway (long-lived Node) |
| package manager | pnpm |

## quick start

```bash
# 1. install dependencies
pnpm install

# 2. configure environment
cp .env.example .env.local
# fill in at minimum ANILIST_CLIENT_ID and ANILIST_CLIENT_SECRET

# 3. start the dev server
pnpm dev
```

other commands:

```bash
pnpm lint        # ESLint (Next.js core-web-vitals + TypeScript rules)
pnpm typecheck   # tsc --noEmit, run before every commit
pnpm build       # production bundle (the CI gate)
pnpm start       # serve production build (Railway / long-lived Node)
```

## environment variables

copy `.env.example` to `.env.local`. required variables are marked.

| variable | required | description |
|---|---|---|
| `ANILIST_GRAPHQL_ENDPOINT` | yes | AniList GraphQL URL (`https://graphql.anilist.co`) |
| `ANILIST_CLIENT_ID` | yes | AniList OAuth app client ID |
| `ANILIST_CLIENT_SECRET` | yes | AniList OAuth app secret |
| `ANILIST_REDIRECT_URI` | yes | OAuth callback (`http://localhost:3000/api/auth/callback/anilist`) |
| `NEXT_PUBLIC_APP_URL` | yes | public base URL of the app |
| `APP_SECRET` | yes | random 32-byte secret for session + token encryption |
| `DATABASE_URL` | no | Postgres connection string. without it, data lives in `data/app-db.json` |
| `ANIMESCHEDULE_API_TOKEN` | no | free token from animeschedule.net, enables airing times and dub data |
| `TMDB_API_KEY` | no | free key from themoviedb.org, enables banner fallback images |
| `STREAMING_PROVIDER_URL` | no | base URL of your streaming API (single provider) |
| `STREAMING_PROVIDER_LABEL` | no | display name shown in the UI |
| `STREAMING_PROVIDER_ID` | no | internal identifier for the provider |
| `STREAMING_PROVIDER_KIND` | no | `search` (default, title-based) or `embed` (AniList-id-keyed URL template) |
| `STREAMING_PROVIDERS` | no | JSON array for multi-server configuration (see `.env.example`) |
| `CRON_SECRET` | no | bearer token for `/api/cron/cleanup` (Vercel cron sends it automatically) |

## architecture overview

MiruCast is built around a strict **provider boundary**: external APIs are never called from pages or UI components. every integration lives in `src/lib/providers/` and returns app-owned types from `src/types/`. UI components depend only on those normalized shapes.

storage is **dual-mode**: a Postgres store (`DATABASE_URL` set) for production, and a local JSON file store for development, both implementing the same `Store` interface from `src/lib/db.ts`.

AniList sync is **two-way**: pushing local edits up (write-through) and pulling remote edits back on a 60-second TTL.

see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full architecture and [`CLAUDE.md`](CLAUDE.md) for the deep provider-by-provider and pattern reference.

## project structure

```
src/
├── app/                  Next.js app router: routes, API handlers, global CSS
│   ├── api/              all API route handlers (thin, logic lives in src/lib)
│   ├── anime/[id]/       anime detail page
│   ├── watch/[id]/       watch page (stream player + episode browser)
│   ├── watchlist/        user library browser
│   ├── history/          watch history
│   ├── profile/          public user profiles
│   ├── schedule/         airing timetable
│   ├── notifications/    new-release notifications
│   ├── search/           search page
│   ├── trending/         trending anime browse
│   ├── airing/           currently airing browse
│   ├── finished/         finished series browse
│   ├── movies/           movie browse
│   ├── upcoming/         upcoming series browse
│   ├── missed-sequels/   sequels the user hasn't added yet
│   ├── globals.css       design tokens and base layout
│   └── polish.css        monochrome design layer (imported after globals.css)
│
├── components/           reusable UI components (server + client)
│   ├── AnimeDetailsShell/ anime detail page composition (server entry + parts)
│   └── ...               all other components (kebab-case filenames)
│
├── lib/                  domain logic and provider adapters
│   ├── providers/        one file per external API (normalize here, not in UI)
│   │   ├── anilist.ts    primary metadata + tracking source
│   │   ├── streaming.ts  stream-source orchestrator (multi-provider)
│   │   └── ...           AniZip, Kitsu, Jikan, TMDB, AnimeSchedule, etc.
│   ├── http/client.ts    shared HTTP client (timeouts, retries, dedup, cache)
│   ├── db.ts             dual-mode store (Postgres + JSON)
│   ├── auth.ts           sessions, hashing, guest accounts, device tracking
│   ├── account-store.ts  library, history, and user record writes
│   ├── anilist-sync.ts   two-way AniList sync orchestration
│   ├── notifications.ts  derived-on-demand release notifications
│   ├── browse-filters.ts shared filter parser for all browse pages
│   ├── rate-limit.ts     sliding-window rate limiter
│   ├── env.ts            typed config access (fail-fast on missing required vars)
│   └── format.ts         user-facing string formatting (titles, dates, durations)
│
└── types/                app-owned TypeScript types
    ├── anime.ts           anime metadata shapes
    ├── account.ts         user, library, history, session types
    └── streaming.ts       streaming provider and source types

docs/
└── ARCHITECTURE.md       architecture decisions, data flow, sync and storage model

data/
└── app-db.json           local dev JSON store (auto-created, gitignored in prod)
```

## deployment

MiruCast deploys to **Vercel** (serverless) or **Railway** (long-lived Node):

```bash
pnpm build   # build the production bundle
pnpm start   # start the Node server (Railway only)
```

set all required environment variables in the platform dashboard. on Vercel, set `DATABASE_URL` to a Postgres connection string (Neon, Vercel Postgres, Supabase, etc.) since the JSON file store doesn't persist on serverless.

GitHub Actions runs `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` on every push to `main` and on pull requests.

## further reading

- [`CLAUDE.md`](CLAUDE.md) — deep technical reference for the codebase: every provider, pattern, and convention explained
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — architecture decisions, data flow, sync model, and streaming rules
- [`AGENTS.md`](AGENTS.md) — contributor guide for AI agents and human contributors alike
