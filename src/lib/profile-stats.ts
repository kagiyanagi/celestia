import type { LibraryEntry, LibraryStatus } from "@/types/account";

export type CountBucket = { label: string; count: number };

export type LibraryStats = {
  total: number;
  episodesWatched: number;
  /** 0-100 scale (display via scoreLabel); null when nothing is scored. */
  meanScore: number | null;
  scoredCount: number;
  statusBreakdown: { status: LibraryStatus; label: string; count: number }[];
  topGenres: CountBucket[];
  formatBreakdown: CountBucket[];
};

const STATUS_ORDER: LibraryStatus[] = [
  "watching",
  "rewatching",
  "completed",
  "on_hold",
  "planning",
  "dropped",
];

const STATUS_LABELS: Record<LibraryStatus, string> = {
  watching: "Watching",
  rewatching: "Rewatching",
  completed: "Completed",
  on_hold: "On hold",
  planning: "Planning",
  dropped: "Dropped",
};

const FORMAT_LABELS: Record<string, string> = {
  TV: "TV",
  TV_SHORT: "TV Short",
  MOVIE: "Movie",
  SPECIAL: "Special",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "Music",
};

function tallyToBuckets(
  counts: Map<string, number>,
  limit?: number,
): CountBucket[] {
  const buckets = Array.from(counts, ([label, count]) => ({ label, count })).sort(
    (a, b) => b.count - a.count,
  );
  return limit ? buckets.slice(0, limit) : buckets;
}

export function computeLibraryStats(entries: LibraryEntry[]): LibraryStats {
  const genres = new Map<string, number>();
  const formats = new Map<string, number>();
  const statusCounts = new Map<LibraryStatus, number>();

  let episodesWatched = 0;
  let scoreTotal = 0;
  let scoredCount = 0;

  for (const entry of entries) {
    episodesWatched += Math.max(0, entry.progress || 0);

    if (entry.score > 0) {
      scoreTotal += entry.score;
      scoredCount += 1;
    }

    statusCounts.set(entry.status, (statusCounts.get(entry.status) ?? 0) + 1);

    for (const genre of entry.anime.genres ?? []) {
      genres.set(genre, (genres.get(genre) ?? 0) + 1);
    }

    const format = entry.anime.format;
    if (format) {
      const label = FORMAT_LABELS[format] ?? format;
      formats.set(label, (formats.get(label) ?? 0) + 1);
    }
  }

  const statusBreakdown = STATUS_ORDER.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    count: statusCounts.get(status) ?? 0,
  })).filter((item) => item.count > 0);

  return {
    total: entries.length,
    episodesWatched,
    meanScore: scoredCount > 0 ? scoreTotal / scoredCount : null,
    scoredCount,
    statusBreakdown,
    topGenres: tallyToBuckets(genres, 8),
    formatBreakdown: tallyToBuckets(formats),
  };
}
