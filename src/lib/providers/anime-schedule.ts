import { fetchJson } from "@/lib/http/client";
import type {
  AiringItem,
  AnimeSummary,
  DubInfo,
  ProviderHealth,
} from "@/types/anime";

const ANIME_SCHEDULE_ENDPOINT =
  process.env.ANIMESCHEDULE_API_BASE_URL ||
  "https://animeschedule.net/api/v3";
const ANIME_SCHEDULE_TOKEN = process.env.ANIMESCHEDULE_API_TOKEN || "";
const MAX_MATCH_TIME_DRIFT_SECONDS = 60 * 60 * 18;

type AnimeScheduleTimetableItem = {
  title?: string;
  route?: string;
  romaji?: string;
  english?: string;
  native?: string;
  delayedText?: string;
  status?: string;
  episodeDate?: string;
  episodeNumber?: number;
  subtractedEpisodeNumber?: number;
  episodes?: number;
  airType?: string;
  airingStatus?: string;
};

type AnimeScheduleResponse =
  | AnimeScheduleTimetableItem[]
  | {
      timetable?: AnimeScheduleTimetableItem[];
      items?: AnimeScheduleTimetableItem[];
      data?: AnimeScheduleTimetableItem[];
    };

type WeekKey = {
  year: number;
  week: number;
};

function isAnimeScheduleConfigured(): boolean {
  return Boolean(ANIME_SCHEDULE_ENDPOINT && ANIME_SCHEDULE_TOKEN);
}

export function getAnimeScheduleProviderHealth(): ProviderHealth {
  return {
    name: "AnimeSchedule",
    role: "metadata",
    status: isAnimeScheduleConfigured() ? "ready" : "disabled",
    notes: isAnimeScheduleConfigured()
      ? "Optional timetable enrichment for airing dates, episode numbers, and delay status."
      : "AnimeSchedule enrichment is disabled. Set ANIMESCHEDULE_API_TOKEN to enable it.",
  };
}

function getHeaders(): HeadersInit {
  if (!ANIME_SCHEDULE_TOKEN) {
    return {};
  }

  return {
    Authorization: `Bearer ${ANIME_SCHEDULE_TOKEN}`,
  };
}

function getIsoWeekKey(date: Date): WeekKey {
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );

  return {
    year: target.getUTCFullYear(),
    week,
  };
}

function getWeekKeys(startAt: number, endAt: number): WeekKey[] {
  const start = new Date(startAt * 1000);
  const end = new Date(Math.max(startAt, endAt - 1) * 1000);
  const keys = new Map<string, WeekKey>();

  [start, end].forEach((date) => {
    const key = getIsoWeekKey(date);
    keys.set(`${key.year}-${key.week}`, key);
  });

  return Array.from(keys.values());
}

function normalizeTitle(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getAiringItemTitles(item: AiringItem): Set<string> {
  return new Set(
    [
      item.anime.title?.romaji,
      item.anime.title?.english,
      item.anime.title?.native,
      item.anime.title?.userPreferred,
    ]
      .map(normalizeTitle)
      .filter(Boolean),
  );
}

function getTimetableTitles(item: AnimeScheduleTimetableItem): string[] {
  return [item.title, item.romaji, item.english, item.native]
    .map(normalizeTitle)
    .filter(Boolean);
}

function getTimetableItems(response: AnimeScheduleResponse) {
  if (Array.isArray(response)) {
    return response;
  }

  return response.timetable || response.items || response.data || [];
}

function isValidScheduleDate(value: string | undefined): boolean {
  if (!value || value.startsWith("0001-01-01")) {
    return false;
  }

  return Number.isFinite(Date.parse(value));
}

function hasTitleMatch(
  airingTitles: Set<string>,
  candidate: AnimeScheduleTimetableItem,
) {
  return getTimetableTitles(candidate).some((title) => airingTitles.has(title));
}

function getCandidateScore(
  item: AiringItem,
  candidate: AnimeScheduleTimetableItem,
): number {
  if (!candidate.episodeNumber || candidate.episodeNumber !== item.episode) {
    return -1;
  }

  if (!hasTitleMatch(getAiringItemTitles(item), candidate)) {
    return -1;
  }

  if (!isValidScheduleDate(candidate.episodeDate)) {
    return -1;
  }

  const candidateAiringAt = Math.floor(
    Date.parse(candidate.episodeDate || "") / 1000,
  );
  const drift = Math.abs(candidateAiringAt - item.airingAt);

  if (drift > MAX_MATCH_TIME_DRIFT_SECONDS) {
    return -1;
  }

  return 100 - Math.floor(drift / 3600);
}

function findBestMatch(
  item: AiringItem,
  candidates: AnimeScheduleTimetableItem[],
) {
  return candidates
    .map((candidate) => ({
      candidate,
      score: getCandidateScore(item, candidate),
    }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)[0]?.candidate;
}

async function getTimetableForWeek(key: WeekKey) {
  const params = new URLSearchParams({
    year: String(key.year),
    week: String(key.week),
    tz: "UTC",
  });

  try {
    const response = await fetchJson<AnimeScheduleResponse>(
      `${ANIME_SCHEDULE_ENDPOINT}/timetables/all?${params.toString()}`,
      {
        headers: getHeaders(),
        next: { revalidate: 300 },
      },
      {
        provider: "AnimeSchedule",
        timeoutMs: 7_000,
        retries: 1,
        retryDelayMs: 500,
        cacheKey: `anime-schedule:timetable:${key.year}:${key.week}`,
        staleTtlMs: 300 * 1000 * 12,
      },
    );

    return getTimetableItems(response);
  } catch (error) {
    console.warn("AnimeSchedule timetable fetch failed", error);
    return [];
  }
}

type DubTimetableEntry = {
  titles: string[];
  episode: number;
  airingAt: number;
  totalEpisodes: number | null;
};

async function getDubTimetableEntries(): Promise<DubTimetableEntry[]> {
  if (!isAnimeScheduleConfigured()) {
    return [];
  }

  const now = Math.floor(Date.now() / 1000);
  // Current week catches dub episodes that already aired; next week catches
  // the upcoming one when the weekly boundary is close.
  const weekKeys = getWeekKeys(now, now + 7 * 86_400);

  return (
    await Promise.all(weekKeys.map((key) => getTimetableForWeek(key)))
  )
    .flat()
    .filter(
      (item) =>
        item.airType?.toLowerCase() === "dub" &&
        typeof item.episodeNumber === "number" &&
        item.episodeNumber > 0 &&
        isValidScheduleDate(item.episodeDate),
    )
    .map((item) => ({
      titles: getTimetableTitles(item),
      episode: item.episodeNumber as number,
      airingAt: Math.floor(Date.parse(item.episodeDate || "") / 1000),
      totalEpisodes: item.episodes || null,
    }));
}

function summarizeDubEntries(
  entries: DubTimetableEntry[],
  now: number,
): DubInfo {
  const aired = entries.filter((entry) => entry.airingAt <= now);
  const upcoming = entries
    .filter((entry) => entry.airingAt > now)
    .sort((a, b) => a.airingAt - b.airingAt);
  const airedCount = aired.length
    ? Math.max(...aired.map((entry) => entry.episode))
    : null;
  const nextDub = upcoming[0] || null;

  return {
    dubbedEpisodes:
      airedCount ?? (nextDub ? Math.max(0, nextDub.episode - 1) : null),
    nextDubEpisode: nextDub
      ? {
          episode: nextDub.episode,
          airingAt: nextDub.airingAt,
          timeUntilAiring: nextDub.airingAt - now,
        }
      : null,
    totalEpisodes:
      entries.find((entry) => entry.totalEpisodes)?.totalEpisodes || null,
  };
}

function getSummaryTitles(anime: AnimeSummary): string[] {
  return [
    anime.title?.romaji,
    anime.title?.english,
    anime.title?.native,
    anime.title?.userPreferred,
  ]
    .map(normalizeTitle)
    .filter(Boolean);
}

/**
 * Batch-enriches card summaries with real dub counts from the weekly dub
 * timetable (a single cached fetch). Only shows with a currently-airing dub
 * get a count; everything else keeps dubCount null ("unknown"), which the
 * UI hides instead of guessing.
 */
export async function enrichSummariesWithDubCounts<T extends AnimeSummary>(
  summaries: T[],
): Promise<T[]> {
  if (!isAnimeScheduleConfigured() || summaries.length === 0) {
    return summaries;
  }

  try {
    const entries = await getDubTimetableEntries();

    if (entries.length === 0) {
      return summaries;
    }

    const byTitle = new Map<string, DubTimetableEntry[]>();
    entries.forEach((entry) => {
      entry.titles.forEach((title) => {
        byTitle.set(title, [...(byTitle.get(title) || []), entry]);
      });
    });

    const now = Math.floor(Date.now() / 1000);

    return summaries.map((anime) => {
      const matched = getSummaryTitles(anime).flatMap(
        (title) => byTitle.get(title) || [],
      );

      if (matched.length === 0) {
        return anime;
      }

      const info = summarizeDubEntries(matched, now);

      return info.dubbedEpisodes != null
        ? { ...anime, dubCount: info.dubbedEpisodes }
        : anime;
    });
  } catch (error) {
    console.warn("Dub count enrichment failed", error);
    return summaries;
  }
}

/**
 * Looks up real dub progress for a show from the AnimeSchedule dub
 * timetable: how many dubbed episodes have aired and when the next one
 * arrives. Returns null when the show has no entry in the current dub
 * timetable (not airing a dub right now, or provider disabled) — callers
 * must treat that as "unknown", not zero.
 */
export async function getDubInfo(
  titles: Array<string | null | undefined>,
): Promise<DubInfo | null> {
  const wantedTitles = new Set(titles.map(normalizeTitle).filter(Boolean));

  if (!isAnimeScheduleConfigured() || wantedTitles.size === 0) {
    return null;
  }

  const candidates = (await getDubTimetableEntries()).filter((entry) =>
    entry.titles.some((title) => wantedTitles.has(title)),
  );

  if (candidates.length === 0) {
    return null;
  }

  return summarizeDubEntries(candidates, Math.floor(Date.now() / 1000));
}

export async function enrichAiringScheduleWithAnimeSchedule(
  items: AiringItem[],
  startAt: number,
  endAt: number,
): Promise<AiringItem[]> {
  if (!isAnimeScheduleConfigured() || items.length === 0) {
    return items;
  }

  const weeklyCandidates = (
    await Promise.all(
      getWeekKeys(startAt, endAt).map((key) => getTimetableForWeek(key)),
    )
  ).flat();

  if (weeklyCandidates.length === 0) {
    return items;
  }

  const now = Math.floor(Date.now() / 1000);

  return items
    .map((item) => {
      const match = findBestMatch(item, weeklyCandidates);

      if (!match?.episodeDate) {
        return {
          ...item,
          source: item.source || "anilist",
          sourceLabel: item.sourceLabel || "AniList",
        };
      }

      const airingAt = Math.floor(Date.parse(match.episodeDate) / 1000);

      return {
        ...item,
        airingAt,
        timeUntilAiring: airingAt - now,
        source: "anime_schedule" as const,
        sourceLabel: "AnimeSchedule",
        airingStatus: match.airingStatus || match.status || null,
      };
    })
    .sort((a, b) => a.airingAt - b.airingAt);
}
