import type { LibraryStatus } from "@/types/account";

/**
 * A single parsed row from a MAL/AniList XML export. AniList exports in the
 * MyAnimeList XML format, so one parser covers both — every entry carries a
 * MAL id (`series_animedb_id`), which we later resolve to an AniList id.
 */
export type ParsedMalEntry = {
  malId: number;
  title: string;
  status: LibraryStatus;
  score: number;
  progress: number;
  repeat: number;
  startedAt: string | null;
  completedAt: string | null;
};

function decodeXmlText(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function readTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decodeXmlText(match[1]) : null;
}

// MAL exports use text labels; older/numeric exports use status codes.
function mapStatus(raw: string | null): LibraryStatus {
  const value = (raw || "").trim().toLowerCase();
  switch (value) {
    case "1":
    case "watching":
    case "currently watching":
      return "watching";
    case "2":
    case "completed":
      return "completed";
    case "3":
    case "on-hold":
    case "on hold":
    case "paused":
      return "on_hold";
    case "4":
    case "dropped":
      return "dropped";
    case "6":
    case "plan to watch":
    case "planning":
    case "plantowatch":
      return "planning";
    default:
      return "planning";
  }
}

// MAL uses the sentinel "0000-00-00" for an unset date.
function parseDate(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value || value.startsWith("0000")) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function toInt(raw: string | null): number {
  const number = Number((raw || "").trim());
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

/**
 * Parses a MyAnimeList / AniList XML export into normalized entries. Tolerant
 * of malformed rows — an entry missing a usable MAL id is skipped rather than
 * throwing, so one bad row never fails the whole import.
 */
export function parseMalExport(xml: string): ParsedMalEntry[] {
  const blocks = xml.match(/<anime>[\s\S]*?<\/anime>/gi) || [];
  const entries: ParsedMalEntry[] = [];

  for (const block of blocks) {
    const malId = toInt(readTag(block, "series_animedb_id"));
    if (!malId) continue;

    const rewatching = (readTag(block, "my_rewatching") || "").trim();
    const status = mapStatus(readTag(block, "my_status"));
    const isRewatching = rewatching === "1" || rewatching.toLowerCase() === "yes";

    entries.push({
      malId,
      title: readTag(block, "series_title") || "",
      status: isRewatching ? "rewatching" : status,
      score: Math.min(100, toInt(readTag(block, "my_score")) * 10),
      progress: toInt(readTag(block, "my_watched_episodes")),
      repeat: toInt(readTag(block, "my_times_watched")),
      startedAt: parseDate(readTag(block, "my_start_date")),
      completedAt: parseDate(readTag(block, "my_finish_date")),
    });
  }

  return entries;
}
