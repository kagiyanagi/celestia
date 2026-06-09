import type { LibraryEntry, LibraryStatus } from "@/types/account";
import type { AnimeSummary } from "@/types/anime";

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
  decadeBreakdown: CountBucket[];
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

export type YearInReview = {
  year: number;
  completed: number;
  episodes: number;
  /** 0-100 scale; null when nothing scored that year. */
  meanScore: number | null;
  topGenre: string | null;
  topAnime: AnimeSummary | null;
};

/**
 * Per-year recap built only from titles the user actually finished (completed
 * or rewatching with a real completion date). Years with no dated completions
 * never appear — nothing is fabricated.
 */
export function computeYearsInReview(entries: LibraryEntry[]): YearInReview[] {
  const byYear = new Map<number, LibraryEntry[]>();

  for (const entry of entries) {
    if (entry.status !== "completed" && entry.status !== "rewatching") {
      continue;
    }
    if (!entry.completedAt) {
      continue;
    }
    const year = new Date(entry.completedAt).getFullYear();
    if (!Number.isFinite(year)) {
      continue;
    }
    const list = byYear.get(year) ?? [];
    list.push(entry);
    byYear.set(year, list);
  }

  const results: YearInReview[] = [];

  for (const [year, list] of byYear) {
    const genres = new Map<string, number>();
    let scoreTotal = 0;
    let scored = 0;
    let episodes = 0;
    let topAnime: AnimeSummary | null = null;
    let topScore = -1;

    for (const entry of list) {
      episodes += Math.max(0, entry.progress || 0);
      if (entry.score > 0) {
        scoreTotal += entry.score;
        scored += 1;
        if (entry.score > topScore) {
          topScore = entry.score;
          topAnime = entry.anime;
        }
      }
      for (const genre of entry.anime.genres ?? []) {
        genres.set(genre, (genres.get(genre) ?? 0) + 1);
      }
    }

    if (!topAnime && list.length) {
      topAnime = list[0].anime;
    }

    const topGenre =
      Array.from(genres).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    results.push({
      year,
      completed: list.length,
      episodes,
      meanScore: scored > 0 ? scoreTotal / scored : null,
      topGenre,
      topAnime,
    });
  }

  return results.sort((a, b) => b.year - a.year);
}

export function computeLibraryStats(entries: LibraryEntry[]): LibraryStats {
  const genres = new Map<string, number>();
  const formats = new Map<string, number>();
  const decades = new Map<string, number>();
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

    const year = entry.anime.seasonYear;
    if (typeof year === "number" && year > 0) {
      const decade = `${Math.floor(year / 10) * 10}s`;
      decades.set(decade, (decades.get(decade) ?? 0) + 1);
    }
  }

  const statusBreakdown = STATUS_ORDER.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    count: statusCounts.get(status) ?? 0,
  })).filter((item) => item.count > 0);

  const decadeBreakdown = Array.from(decades, ([label, count]) => ({
    label,
    count,
  })).sort((a, b) => a.label.localeCompare(b.label));

  return {
    total: entries.length,
    episodesWatched,
    meanScore: scoredCount > 0 ? scoreTotal / scoredCount : null,
    scoredCount,
    statusBreakdown,
    topGenres: tallyToBuckets(genres, 8),
    formatBreakdown: tallyToBuckets(formats),
    decadeBreakdown,
  };
}
