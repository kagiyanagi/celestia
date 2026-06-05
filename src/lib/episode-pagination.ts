/**
 * Shared episode list/search/pagination logic, used by the client
 * `EpisodeBrowser` and the `/api/anime/[id]/episodes` endpoint so the two
 * always agree on page size and filtering.
 *
 * Normal shows ship their whole episode list to the browser and search/sort
 * client-side. Mega-shows (1000+ episodes) would serialize ~1 MB of HTML, so
 * above `CLIENT_EPISODE_CAP` the browser ships one page and fetches the rest
 * (and search results) from the endpoint instead.
 */

export const EPISODES_PER_PAGE = 47;

/** Above this episode count, the browser paginates against the server instead
 *  of holding every episode in the client payload. */
export const CLIENT_EPISODE_CAP = 300;

export type ListEpisode = {
  number: number;
  title: string | null;
  description: string | null;
  thumbnail: string | null;
  airDate?: string | null;
  rating?: number | null;
};

export function matchesEpisodeQuery(
  episode: ListEpisode,
  normalizedQuery: string,
): boolean {
  return (
    String(episode.number).includes(normalizedQuery) ||
    (episode.title || "").toLowerCase().includes(normalizedQuery) ||
    (episode.description || "").toLowerCase().includes(normalizedQuery)
  );
}

/** Filters by query, sorts, and slices to one page — the same transform the
 *  browser applies client-side, so paginated and non-paginated modes match. */
export function searchSortPageEpisodes<T extends ListEpisode>(
  episodes: T[],
  options: { query?: string; order?: "asc" | "desc"; page?: number },
): { episodes: T[]; matched: number } {
  const normalizedQuery = (options.query ?? "").trim().toLowerCase();
  const filtered = normalizedQuery
    ? episodes.filter((episode) => matchesEpisodeQuery(episode, normalizedQuery))
    : episodes;

  const sorted =
    (options.order ?? "asc") === "asc" ? filtered : [...filtered].reverse();

  const page = Math.max(1, Math.floor(options.page ?? 1) || 1);
  const start = (page - 1) * EPISODES_PER_PAGE;

  return {
    episodes: sorted.slice(start, start + EPISODES_PER_PAGE),
    matched: filtered.length,
  };
}
