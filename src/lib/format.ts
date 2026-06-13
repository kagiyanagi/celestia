import type { AnimeDate, AnimeTitle } from "@/types/anime";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** AniList fuzzy date as "12 Mar 2025"; null when the date is unknown. */
export function formatAnimeDate(
  date: AnimeDate | null | undefined,
): string | null {
  if (!date?.year) {
    return null;
  }

  return [
    date.day,
    date.month ? MONTH_NAMES[date.month - 1] : null,
    date.year,
  ]
    .filter(Boolean)
    .join(" ");
}

const relativeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
  style: "short",
});

export type TitleLanguage = "english" | "romaji" | "native";

export function getDisplayTitle(
  title?: AnimeTitle | null,
  language: TitleLanguage = "english",
): string {
  if (!title) return "Untitled anime";

  const byLanguage: Record<TitleLanguage, (string | null | undefined)[]> = {
    english: [title.english, title.userPreferred, title.romaji, title.native],
    romaji: [title.romaji, title.english, title.native],
    native: [title.native, title.romaji, title.english],
  };

  return byLanguage[language].find(Boolean) || "Untitled anime";
}

export function getSecondaryTitle(
  title?: AnimeTitle | null,
  language: TitleLanguage = "english",
): string | null {
  if (!title) return null;
  const primary = getDisplayTitle(title, language);
  const secondary = title.romaji || title.native;

  return secondary && secondary !== primary ? secondary : null;
}

export function compactNumber(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "N/A";
  }

  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** AniList 0-100 score shown on a 10-point scale, e.g. "8.7". */
export function scoreLabel(value: number | null | undefined): string {
  return typeof value === "number" ? (value / 10).toFixed(1) : "Unrated";
}

export function minutesLabel(value: number | null | undefined): string {
  return typeof value === "number" ? `${value} min` : "Unknown";
}

export function episodeLabel(value: number | null | undefined): string {
  return typeof value === "number" ? `${value} eps` : "Ongoing";
}

export function formatAiringTime(epochSeconds: number): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(epochSeconds * 1000));
}

export function formatRelativeSeconds(seconds: number): string {
  const abs = Math.abs(seconds);
  const divisions = [
    { amount: 60 * 60 * 24 * 7, unit: "week" as const },
    { amount: 60 * 60 * 24, unit: "day" as const },
    { amount: 60 * 60, unit: "hour" as const },
    { amount: 60, unit: "minute" as const },
  ];

  for (const division of divisions) {
    if (abs >= division.amount) {
      return relativeFormatter.format(
        Math.round(seconds / division.amount),
        division.unit,
      );
    }
  }

  return relativeFormatter.format(Math.round(seconds), "second");
}

/** "4d 6h 23m" style countdown with minute accuracy. */
export function formatCountdownSeconds(seconds: number): string {
  const abs = Math.max(0, Math.floor(seconds));
  const days = Math.floor(abs / 86_400);
  const hours = Math.floor((abs % 86_400) / 3_600);
  const minutes = Math.floor((abs % 3_600) / 60);
  const parts: string[] = [];

  if (days) {
    parts.push(`${days}d`);
  }

  if (hours) {
    parts.push(`${hours}h`);
  }

  if (minutes || !parts.length) {
    parts.push(`${minutes}m`);
  }

  return parts.join(" ");
}

/** ISO "2024-10-04" → "4 Oct 2024"; null for unknown/partial dates. */
export function formatIsoDate(value: string | null | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");

  if (!match) {
    return null;
  }

  const month = MONTH_NAMES[Number(match[2]) - 1];

  return month ? `${Number(match[3])} ${month} ${match[1]}` : null;
}

/**
 * Full ISO timestamp → "4 Oct 2024, 3:00 PM" in the viewer's locale; null when
 * unparseable. Use only for values that genuinely carry a time (e.g. ani.zip's
 * airDateUtc) - never for a date-only string, which would fabricate midnight.
 */
export function formatIsoDateTime(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function cleanDescription(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .replace(/\(Source:.*?\)$/i, "")
    .trim();
}
