import { fetchJson, ProviderFetchError } from "@/lib/http/client";
import {
  getEnglishDubSets,
  hasCompleteEnglishDub,
  type EnglishDubSets,
} from "@/lib/providers/dub-status";
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

// The /anime endpoint only filters by a SINGLE anilist-id (repeated/comma
// params 404; the bracket form is silently ignored and returns the whole
// catalog), so records are fetched one id per request. Bound how many of those
// run at once - the API rate-limits and bursts cause connection timeouts.
const RECORD_CONCURRENCY = 5;
// How far back/forward to scan the dub timetable for a title's current and
// next dub episode.
const DUB_WINDOW_SECONDS = 14 * 86_400;

type EpisodeOverride = {
  overrideDate?: string;
  overrideEpisode?: number;
  episodesAired?: number;
};

/**
 * The per-anime "Anime" object from `GET /anime?anilist-ids=...`. Unlike the
 * weekly timetable, this is the authoritative per-title record. `dubPremier`
 * is the canonical "does an English dub exist" signal: the `0001-01-01`
 * sentinel (or a missing value) means there is no dub - `dubTime` is populated
 * regardless, so it must never be used to infer dub existence.
 */
type AnimeScheduleRecord = {
  id?: string;
  route?: string;
  title?: string;
  english?: string;
  romaji?: string;
  status?: string;
  episodes?: number | null;
  premier?: string;
  subPremier?: string;
  dubPremier?: string;
  dubTime?: string;
  dubEpisodeOverride?: EpisodeOverride;
  dubDelayedFrom?: string;
  dubDelayedUntil?: string;
  dubDelayedTimetable?: string;
  websites?: { aniList?: string; mal?: string };
};

type AnimeListResponse = {
  page?: number;
  totalAmount?: number;
  anime?: AnimeScheduleRecord[];
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
  const keys = new Map<string, WeekKey>();
  const end = Math.max(startAt, endAt - 1);

  // Walk a day at a time so every ISO week the range touches is covered, not
  // just the first and last - a multi-week window (e.g. 30-day notifications)
  // must not silently drop the weeks in between.
  for (let cursor = startAt; cursor <= end; cursor += 86_400) {
    const key = getIsoWeekKey(new Date(cursor * 1000));
    keys.set(`${key.year}-${key.week}`, key);
  }

  if (keys.size === 0) {
    const key = getIsoWeekKey(new Date(startAt * 1000));
    keys.set(`${key.year}-${key.week}`, key);
  }

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
  route: string;
  episode: number;
  airingAt: number;
  totalEpisodes: number | null;
};

/**
 * Dub episodes from the weekly timetable within [startAt, endAt], tagged with
 * their AnimeSchedule `route` (slug) so callers can match them to a verified
 * per-anime record by slug instead of by fuzzy title.
 */
async function getDubTimetableEntries(
  startAt: number,
  endAt: number,
): Promise<DubTimetableEntry[]> {
  if (!isAnimeScheduleConfigured()) {
    return [];
  }

  const weekKeys = getWeekKeys(startAt, endAt);

  return (await Promise.all(weekKeys.map((key) => getTimetableForWeek(key))))
    .flat()
    .filter(
      (item) =>
        item.airType?.toLowerCase() === "dub" &&
        typeof item.route === "string" &&
        item.route.length > 0 &&
        typeof item.episodeNumber === "number" &&
        item.episodeNumber > 0 &&
        isValidScheduleDate(item.episodeDate),
    )
    .map((item) => ({
      route: item.route as string,
      episode: item.episodeNumber as number,
      airingAt: Math.floor(Date.parse(item.episodeDate || "") / 1000),
      totalEpisodes: item.episodes || null,
    }));
}

function groupDubEntriesByRoute(
  entries: DubTimetableEntry[],
): Map<string, DubTimetableEntry[]> {
  const byRoute = new Map<string, DubTimetableEntry[]>();
  entries.forEach((entry) => {
    byRoute.set(entry.route, [...(byRoute.get(entry.route) || []), entry]);
  });
  return byRoute;
}

function extractAnilistId(url: string | undefined): number | null {
  const match = (url || "").match(/anime\/(\d+)/);
  return match ? Number(match[1]) : null;
}

/**
 * Fetches the AnimeSchedule records for a single AniList id (one cour may
 * return several rows - e.g. the main entry plus a shared special). A 404 just
 * means AnimeSchedule has no entry for this id, which is normal and quiet.
 */
async function fetchAnimeRecord(
  anilistId: number,
): Promise<AnimeScheduleRecord[]> {
  try {
    const response = await fetchJson<AnimeListResponse>(
      `${ANIME_SCHEDULE_ENDPOINT}/anime?anilist-ids=${anilistId}`,
      {
        headers: getHeaders(),
        next: { revalidate: 21600 },
      },
      {
        provider: "AnimeSchedule",
        timeoutMs: 7_000,
        retries: 1,
        retryDelayMs: 500,
        cacheKey: `anime-schedule:anime:${anilistId}`,
        staleTtlMs: 21600 * 1000 * 4,
      },
    );
    return response?.anime || [];
  } catch (error) {
    if (error instanceof ProviderFetchError && error.status === 404) {
      return []; // no AnimeSchedule entry for this id - expected, not an error
    }
    console.warn("AnimeSchedule record fetch failed", error);
    return [];
  }
}

/**
 * Resolves AniList ids to their AnimeSchedule records, one request per id (the
 * endpoint has no working batch filter) through a bounded-concurrency pool.
 * Each id is cached individually, so warm loads are free and ids shared across
 * surfaces are deduped at the HTTP layer.
 */
async function fetchAnimeRecordsByAnilistIds(
  ids: number[],
): Promise<Map<number, AnimeScheduleRecord[]>> {
  const byAnilistId = new Map<number, AnimeScheduleRecord[]>();
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));

  if (!isAnimeScheduleConfigured() || uniqueIds.length === 0) {
    return byAnilistId;
  }

  let cursor = 0;
  const worker = async () => {
    while (cursor < uniqueIds.length) {
      const id = uniqueIds[cursor];
      cursor += 1;

      const records = await fetchAnimeRecord(id);
      // The query is filtered by this id; keep only rows the API attributes to
      // it (records without a websites link still belong, since the API
      // returned them for this id) - never let a stray result bleed in.
      const kept = records.filter((record) => {
        const recordId = extractAnilistId(record.websites?.aniList);
        return recordId === null || recordId === id;
      });
      if (kept.length) {
        byAnilistId.set(id, kept);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(RECORD_CONCURRENCY, uniqueIds.length) }, worker),
  );

  return byAnilistId;
}

/**
 * Several AnimeSchedule rows can map to one AniList id (e.g. a cour plus its
 * 1-episode special). Prefer the row whose episode count matches the AniList
 * entry; otherwise fall back to the longest (the main cour, not a special).
 */
function pickAnimeRecord(
  records: AnimeScheduleRecord[] | undefined,
  expectedEpisodes: number | null,
): AnimeScheduleRecord | null {
  if (!records || records.length === 0) {
    return null;
  }
  if (records.length === 1) {
    return records[0];
  }

  if (expectedEpisodes) {
    const exact = records.find(
      (record) => record.episodes === expectedEpisodes,
    );
    if (exact) {
      return exact;
    }
    return [...records].sort(
      (a, b) =>
        Math.abs((a.episodes || 0) - expectedEpisodes) -
        Math.abs((b.episodes || 0) - expectedEpisodes),
    )[0];
  }

  return [...records].sort((a, b) => (b.episodes || 0) - (a.episodes || 0))[0];
}

/**
 * Derives dub info from an authoritative AnimeSchedule record. `dubPremier` is
 * the gate: a missing value or the `0001-01-01` sentinel means the title has no
 * English dub, so we return null and the UI shows nothing rather than a
 * fabricated countdown. Episode progress comes from the dub timetable matched
 * by the record's own slug (never a fuzzy title), so a different season or
 * franchise listing can't bleed in.
 */
function deriveDubInfo(
  record: AnimeScheduleRecord,
  dubByRoute: Map<string, DubTimetableEntry[]>,
  now: number,
): DubInfo | null {
  if (!isValidScheduleDate(record.dubPremier)) {
    return null;
  }

  const total =
    typeof record.episodes === "number" && record.episodes > 0
      ? record.episodes
      : null;
  const premierAt = Math.floor(Date.parse(record.dubPremier as string) / 1000);
  const isFinished = (record.status || "").toLowerCase() === "finished";

  const entries = (record.route && dubByRoute.get(record.route)) || [];
  const aired = entries.filter((entry) => entry.airingAt <= now);
  const upcoming = entries
    .filter((entry) => entry.airingAt > now)
    .sort((a, b) => a.airingAt - b.airingAt);
  const airedMax = aired.length
    ? Math.max(...aired.map((entry) => entry.episode))
    : null;

  let dubbedEpisodes: number | null;
  if (airedMax != null) {
    dubbedEpisodes = total ? Math.min(airedMax, total) : airedMax;
  } else if (isFinished) {
    dubbedEpisodes = total; // a finished dub has every episode dubbed
  } else if (premierAt > now) {
    dubbedEpisodes = 0; // dub confirmed but not started yet
  } else {
    dubbedEpisodes = null; // airing but no dub episode in the window: unknown
  }

  let nextDubEpisode: DubInfo["nextDubEpisode"] = null;
  if (upcoming[0]) {
    nextDubEpisode = {
      episode: upcoming[0].episode,
      airingAt: upcoming[0].airingAt,
      timeUntilAiring: upcoming[0].airingAt - now,
    };
  } else if (premierAt > now) {
    // Not in the timetable window yet, but the dub premiere date is confirmed.
    nextDubEpisode = {
      episode: 1,
      airingAt: premierAt,
      timeUntilAiring: premierAt - now,
    };
  }

  return { dubbedEpisodes, nextDubEpisode, totalEpisodes: total };
}

/**
 * Fills the count AnimeSchedule can't provide for older catalog titles (its dub
 * data only covers ~2020+ simulcasts). AnimeSchedule's count always wins; only
 * when it has none do we consult MyDubList: a FINISHED show with a complete
 * English dub has every episode dubbed, so the count equals its episode total.
 * Ongoing shows are left alone - their live count isn't knowable this way.
 */
function withDubListFallback(
  info: DubInfo | null,
  options: {
    status?: string | null;
    episodes?: number | null;
    malId?: number | null;
  },
  sets: EnglishDubSets | null,
): DubInfo | null {
  if (info?.dubbedEpisodes != null) {
    return info;
  }

  const isFinished = (options.status || "").toUpperCase() === "FINISHED";
  if (isFinished && options.episodes && hasCompleteEnglishDub(sets, options.malId)) {
    return {
      dubbedEpisodes: options.episodes,
      nextDubEpisode: info?.nextDubEpisode ?? null,
      totalEpisodes: options.episodes,
    };
  }

  return info;
}

/**
 * Batch-enriches card summaries with real dub counts. Each summary is resolved
 * to its AnimeSchedule record by AniList id (verified, never title-matched) and
 * gated on `dubPremier`. When AnimeSchedule has no count (older catalog titles),
 * MyDubList fills finished shows with a complete dub. Shows with no verifiable
 * dub keep `dubCount` null ("unknown"), which the UI hides instead of guessing.
 */
export async function enrichSummariesWithDubCounts<T extends AnimeSummary>(
  summaries: T[],
): Promise<T[]> {
  if (summaries.length === 0) {
    return summaries;
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const ids = summaries.map((summary) => summary.id);

    const [recordsById, dubEntries, dubSets] = await Promise.all([
      fetchAnimeRecordsByAnilistIds(ids),
      getDubTimetableEntries(now - DUB_WINDOW_SECONDS, now + DUB_WINDOW_SECONDS),
      getEnglishDubSets(),
    ]);
    const dubByRoute = groupDubEntriesByRoute(dubEntries);

    return summaries.map((anime) => {
      const record = pickAnimeRecord(
        recordsById.get(anime.id),
        anime.airingCount ?? anime.episodes ?? null,
      );
      const info = withDubListFallback(
        record ? deriveDubInfo(record, dubByRoute, now) : null,
        { status: anime.status, episodes: anime.episodes, malId: anime.idMal },
        dubSets,
      );

      return info && info.dubbedEpisodes != null
        ? { ...anime, dubCount: info.dubbedEpisodes }
        : anime;
    });
  } catch (error) {
    console.warn("Dub count enrichment failed", error);
    return summaries;
  }
}

export type RecentDubDrop = {
  animeId: number;
  episode: number;
  airedAt: number;
};

/**
 * Returns dub episodes that aired on or after `sinceEpoch` for the given
 * library entries. Each entry is resolved to its AnimeSchedule record by
 * AniList id and gated on `dubPremier`; only titles with a real dub contribute,
 * and drops are taken from the dub timetable matched by the record's slug - no
 * title guessing. Powers "new dub episode" notifications.
 */
export async function getRecentDubDrops(
  entries: Array<{ animeId: number; anime: AnimeSummary }>,
  sinceEpoch: number,
): Promise<RecentDubDrop[]> {
  if (!isAnimeScheduleConfigured() || entries.length === 0) {
    return [];
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const [recordsById, dubEntries] = await Promise.all([
      fetchAnimeRecordsByAnilistIds(entries.map((entry) => entry.animeId)),
      getDubTimetableEntries(sinceEpoch, now),
    ]);
    const dubByRoute = groupDubEntriesByRoute(dubEntries);

    const drops: RecentDubDrop[] = [];
    const seen = new Set<string>();

    for (const { animeId, anime } of entries) {
      const record = pickAnimeRecord(
        recordsById.get(animeId),
        anime.airingCount ?? anime.episodes ?? null,
      );
      // Only titles with a real dub (valid dubPremier) and a matched slug.
      if (!record || !isValidScheduleDate(record.dubPremier) || !record.route) {
        continue;
      }

      for (const entry of dubByRoute.get(record.route) || []) {
        if (entry.airingAt < sinceEpoch || entry.airingAt > now) {
          continue;
        }
        const key = `${animeId}:${entry.episode}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        drops.push({ animeId, episode: entry.episode, airedAt: entry.airingAt });
      }
    }

    return drops;
  } catch (error) {
    console.warn("Recent dub drops lookup failed", error);
    return [];
  }
}

/**
 * Looks up real dub progress for a show by AniList id: whether a dub exists
 * (gated on `dubPremier`), how many dubbed episodes have aired, and when the
 * next arrives. When AnimeSchedule has no data (older catalog titles), falls
 * back to MyDubList for finished shows with a complete dub. Returns null when
 * no dub can be verified - callers treat that as "unknown", not zero.
 * `expectedEpisodes` disambiguates a cour vs its special sharing an AniList id,
 * and is the episode total used for the finished-dub fallback.
 */
export async function getDubInfo(
  anilistId: number,
  options: {
    expectedEpisodes?: number | null;
    idMal?: number | null;
    status?: string | null;
  } = {},
): Promise<DubInfo | null> {
  const now = Math.floor(Date.now() / 1000);

  let info: DubInfo | null = null;
  if (isAnimeScheduleConfigured() && anilistId) {
    const [recordsById, dubEntries] = await Promise.all([
      fetchAnimeRecordsByAnilistIds([anilistId]),
      getDubTimetableEntries(now - DUB_WINDOW_SECONDS, now + DUB_WINDOW_SECONDS),
    ]);
    const record = pickAnimeRecord(
      recordsById.get(anilistId),
      options.expectedEpisodes ?? null,
    );
    if (record) {
      info = deriveDubInfo(record, groupDubEntriesByRoute(dubEntries), now);
    }
  }

  return withDubListFallback(
    info,
    {
      status: options.status,
      episodes: options.expectedEpisodes,
      malId: options.idMal,
    },
    await getEnglishDubSets(),
  );
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
