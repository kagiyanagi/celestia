# Celestia

Celestia is an anime watching and tracking website. AniList is the primary metadata and tracking source, while streaming is routed through a swappable provider adapter.

## Current Build

- Next.js App Router with TypeScript.
- AniList GraphQL provider for trending, seasonal, search, detail, characters, relations, recommendations, and airing data.
- Local browser tracking on anime detail pages as the first progress ledger.
- Provider health endpoint at `/api/health`.
- Streaming Provider streaming is enabled by default through the streaming adapter.

## Commands

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm build
```

## Environment

Copy `.env.example` to `.env.local` when credentials are available.

```bash
ANILIST_GRAPHQL_ENDPOINT=https://graphql.anilist.co
STREAMING_PROVIDER=streaming-provider
STREAMING_PROVIDER_BASE_URL=https://streaming-provider.xyz
```

## Product Direction

The durable product value should come from a strong watching experience plus tracking quality: episode progress, reminders, watch calendar, franchise timelines, characters, staff, studios, and advanced filters.

Streaming should remain provider-based and replaceable. The watch page requests playback data only when the user opens it, and the rest of the app should continue working if one provider breaks.
