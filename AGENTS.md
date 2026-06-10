# AGENTS.md — Contributor Guide

This file is the contributor guide for both AI agents and human developers. It covers what the project does, how to work in it, and what rules to follow.

## Project

**Celestia** is an anime watching and tracking site built on Next.js 15 (App Router), React 19, and TypeScript in strict mode. AniList is the primary metadata and library-sync source. Streaming is routed through a swappable provider adapter and is deliberately treated as non-core, replaceable infrastructure.

The production bar before any change: `pnpm lint` + `pnpm typecheck` + `pnpm build` — all green.

## Commands

```bash
pnpm install                  # Sync deps from pnpm-lock.yaml (use --frozen-lockfile in CI)
pnpm dev                      # Local Next.js dev server
pnpm build                    # Production bundle — same gate CI uses
pnpm start                    # Serve a production build (Railway / long-lived Node)
pnpm lint                     # ESLint: next/core-web-vitals + TypeScript rules
pnpm typecheck                # tsc --noEmit — run this before every commit
```

There is **no automated test suite**. The three commands above are the only quality gates. When adding tests, place them near the feature (`anime-season.test.ts` next to `anime-season.ts`) or in `tests/`. Prioritize coverage for provider normalization, route handlers, and failure paths around sync and streaming.

## Module Structure

| Path | Purpose |
|---|---|
| `src/app/` | Next.js App Router: routes, API handlers, loading states, global CSS |
| `src/app/api/` | Thin API route handlers — auth, library, history, streaming, health |
| `src/components/` | Reusable UI: server components, client islands, and skeletons |
| `src/lib/` | All domain logic and provider adapters |
| `src/lib/providers/` | One file per external API; normalizes third-party responses into app types |
| `src/lib/http/client.ts` | Shared HTTP client: timeouts, retries, dedup, stale cache |
| `src/lib/db.ts` | Dual-mode Store: Postgres or local JSON file, same interface |
| `src/lib/auth.ts` | Cookie sessions, scrypt hashing, guest accounts, device tracking |
| `src/lib/account-store.ts` | Library entries, history entries, and user record mutations |
| `src/lib/env.ts` | Typed config — read vars here, not from `process.env` directly |
| `src/types/` | App-owned TypeScript shapes; never raw third-party API shapes |

Import alias: `@/*` → `src/*`.

## Coding Conventions

- **2-space indentation, double quotes** throughout.
- **Kebab-case filenames**: `home-hero-carousel.tsx`, `watch/[id]/page.tsx`. The sole exception is the `AnimeDetailsShell/` component directory which uses PascalCase.
- **App-owned types in `src/types/`** — normalize third-party shapes in providers, not in UI.
- **No `process.env` outside `src/lib/env.ts`** — all config reads go through `getEnv()` so misconfiguration fails in one place. Exception: `streaming.ts` reads `STREAMING_PROVIDER_KIND` directly because it selects the adapter at module init time.
- **No raw `fetch` calls in providers** — route all outbound requests through `fetchJson` in `src/lib/http/client.ts` so timeouts, retries, dedup, and caching are applied consistently.
- **Small, focused modules** — push logic into `src/lib`, keep route handlers and page files thin.

## Provider Rules

These rules are non-negotiable. Violating them causes silent data corruption or incorrect UI:

1. External APIs are **never called from pages or components**. All integrations live in `src/lib/providers/`.
2. Provider functions return **app-owned types** from `src/types/`, never raw API shapes. Normalize in the provider (or its transformer), not downstream.
3. When adding a field from an external API, add it to the relevant type in `src/types/`, normalize it in the provider, and consume the normalized field in the UI.
4. The app **never fabricates data** it cannot verify. Unverifiable values render as "unknown" or are hidden — never as a confident `0` or a guess. This applies to episode counts, dub status, days watched, and stream matches.
5. Streaming must remain **demand-only** — playback data is fetched only when the user opens the watch page. The rest of the app must stay fully functional if a provider fails.

## Styling Rules

- **No Tailwind, no CSS modules** — styling is plain global CSS with custom properties.
- Design tokens (`--bg`, `--panel`, `--text`, `--radius`, etc.) are defined in `src/app/globals.css`.
- `src/app/polish.css` is the monochrome design layer; it is imported _after_ `globals.css` in `layout.tsx` — order matters.
- Style against variables (`var(--panel)`, `var(--muted)`) rather than hardcoded colors.

## Page Composition Pattern

Route pages are **thin server components** that fetch data via providers and pass it to a co-located client island for interactivity. Never mark a route file itself as `"use client"`. Data fetching lives in the server route file; interactivity lives in the `*-page-client.tsx` island.

## Commit Convention

All commits follow **Conventional Commits** with a mandatory body:

```
type(scope): short imperative subject (≤72 chars)

Explain what changed and why. Be specific about which files, functions,
or behaviors changed and what motivated it. 3–8 sentences per commit.
```

**Types**: `feat`, `fix`, `refactor`, `style`, `docs`, `chore`, `perf`, `ci`.

**Scopes** (examples): `auth`, `streaming`, `anilist`, `db`, `ui`, `api`, `deps`, `config`.

Examples:
```
feat(streaming): add embed adapter for AniList-id-keyed provider URLs

fix(history): correct episode title and thumbnail display in history cards

chore(deps): add Vercel Analytics and Speed Insights
```
