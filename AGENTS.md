# Repository Guidelines

## Project Structure & Module Organization
`src/app` contains the Next.js App Router entrypoints, route segments, loading states, and API routes such as `src/app/api/health/route.ts`. Reusable UI lives in `src/components`. Domain logic and provider adapters live in `src/lib`, with external integrations under `src/lib/providers`. Shared TypeScript models belong in `src/types`. Reference notes and higher-level design decisions are documented in `docs/ARCHITECTURE.md`.

## Build, Test, and Development Commands
Use `pnpm install` to sync dependencies from `pnpm-lock.yaml`. Run `pnpm dev` to start the local Next.js server. Run `pnpm lint` for ESLint with the Next core-web-vitals and TypeScript rules. Run `pnpm typecheck` before opening a PR to catch contract drift in provider and page code. Use `pnpm build` to verify the production bundle.

## Coding Style & Naming Conventions
Write TypeScript with 2-space indentation and follow the existing double-quote style. Preserve the current kebab-case file naming used across components and routes, for example `home-hero-carousel.tsx` and `src/app/watch/[id]/page.tsx`. Keep app-owned data shapes in `src/types`, and normalize third-party API responses inside provider modules rather than in UI components. Prefer small, focused server/page modules and move reusable logic into `src/lib`.

## Testing Guidelines
There is no automated test suite yet. For now, every change should pass `pnpm lint`, `pnpm typecheck`, and `pnpm build`. When adding tests, place them near the feature or in a dedicated `tests/` folder, and name them after the unit under test, for example `anime-season.test.ts`. Prioritize coverage for provider normalization, route handlers, and failure paths around streaming lookups.

## Commit & Pull Request Guidelines
This repository does not have committed history yet, so adopt a simple convention now: short imperative commit subjects such as `Add airing page fallback`. Keep each commit scoped to one concern. PRs should include a brief summary, note any environment or provider changes, link the relevant issue when one exists, and attach screenshots for UI changes in `src/app` or `src/components`.

## Security & Configuration Tips
Keep provider endpoints and credentials in `.env.local`; do not hardcode them in routes or components. Current environment values are documented in `README.md`, including `ANILIST_GRAPHQL_ENDPOINT`, `STREAMING_PROVIDER`, and `STREAMING_PROVIDER_BASE_URL`. Treat streaming as replaceable infrastructure and keep the app usable when a provider fails.
