import type { HistoryEntry } from "@/types/account";

/**
 * The episode to resume from a history entry. A finished episode (>=90%)
 * advances to the next one, but only when a provider confirms it exists
 * (airingCount, or the total for a finished show) - never past verified data.
 * Otherwise it returns the same episode so the user picks up where they left.
 */
export function getResumeEpisode(entry: HistoryEntry): number {
  const finished = entry.progressPercent >= 90;
  const maxEpisode = entry.anime.airingCount ?? entry.anime.episodes ?? null;
  const advance = finished && maxEpisode != null && entry.episode < maxEpisode;
  return advance ? entry.episode + 1 : entry.episode;
}
