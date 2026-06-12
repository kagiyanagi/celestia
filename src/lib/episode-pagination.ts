/**
 * Shared episode list/search helpers used by the client `EpisodeBrowser`.
 *
 * The full episode list ships in the page payload (it compresses to a few KB
 * even for 1000+ episode shows), so search/sort/pagination all run client-side
 * for instant filtering - no per-page server round trip.
 */

export const EPISODES_PER_PAGE = 47;

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
