# Celestia

Celestia is an anime watching and tracking website. AniList is the primary metadata and tracking source, while streaming is routed through a swappable provider adapter.

## Current Build

- Next.js App Router with TypeScript.
- AniList GraphQL provider for trending, seasonal, search, detail, characters, relations, recommendations, and airing data.
- Local browser tracking on anime detail pages as the first progress ledger.
- Provider health endpoint at `/api/health`.
- Streaming is supported through a swappable adapter. Configure your own API in the environment variables.

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
ANILIST_CLIENT_ID=
ANILIST_CLIENT_SECRET=
ANILIST_REDIRECT_URI=http://localhost:3000/api/auth/callback/anilist
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Streaming Configuration (Bring your own API)
STREAMING_PROVIDER_URL=https://your-api.com
STREAMING_PROVIDER_LABEL="My Provider"
STREAMING_PROVIDER_ID=my-custom-provider

# Optional multi-server configuration.
# Lower priority values are tried first. The legacy STREAMING_PROVIDER_* vars
# above are still supported when this is not set.
STREAMING_PROVIDERS='[
  {"id":"server-a","label":"Server A","url":"https://server-a.example.com","priority":10},
  {"id":"server-b","label":"Server B","url":"https://server-b.example.com","priority":20}
]'
```

## Deployment

Celestia can be deployed to Vercel or Railway with the same build command:

```bash
pnpm build
```

Set the environment variables above in the platform dashboard. For Vercel,
server routes and provider fetches run as serverless functions. For Railway,
the app can run as a long-lived Node service with `pnpm start` after `pnpm build`.

Current persistence is prototype-only: account/session data is stored in
`data/app-db.json`, which is ignored by git and is not durable on Vercel. Use a
managed database before treating accounts, sessions, library entries, or history
as production data.

GitHub Actions runs `pnpm install --frozen-lockfile`, `pnpm lint`,
`pnpm typecheck`, and `pnpm build` on pushes to `main` and pull requests.

## Product Direction

The durable product value should come from a strong watching experience plus tracking quality: episode progress, reminders, watch calendar, franchise timelines, characters, staff, studios, and advanced filters.

Streaming should remain provider-based and replaceable. The watch page requests playback data only when the user opens it, and the rest of the app should continue working if one provider breaks.
