# Celstia Architecture

## Provider Strategy

Celstia uses provider boundaries instead of wiring third-party APIs directly into pages.

- `AniList`: primary metadata, discovery, airing schedule, details, relations, characters, recommendations, and future account tracking.
- `Streaming`: a swappable provider adapter. Streaming Provider is the current temporary provider.

## Data Flow

Pages call normalized provider functions from `src/lib/providers`. Provider functions convert external API shapes into app-owned types from `src/types`. UI components should not depend on raw AniList or streaming-provider response fields.

## Tracking Plan

The current detail page includes a local browser ledger. The next durable step is an app database with this shape:

- `users`: app account identity and linked provider identities.
- `anime`: normalized AniList IDs, titles, metadata cache, and provider mappings.
- `tracking_entries`: status, score, progress, rewatches, notes, and timestamps.
- `sync_jobs`: provider, direction, status, retry count, and error payload.
- `stream_mappings`: optional provider IDs, availability, last checked timestamp, and confidence score.

## Sync Rules

AniList should be the primary modern tracking source. Conflicts between local progress and AniList progress should be visible and explicit, not silently overwritten.

## Streaming Rules

Streaming must not be part of the core domain model. Treat playback as a provider capability:

- Lookup only on watch-page demand.
- Cache availability separately from user progress.
- Fail closed with a clear message.
- Keep the detail, search, schedule, and tracking pages fully functional if one stream provider fails.
