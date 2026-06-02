import type { AnimeTitle } from "@/types/anime";

const relativeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
  style: "short",
});

export function getDisplayTitle(title?: AnimeTitle | null): string {
  if (!title) return "Untitled anime";
  return (
    title.english ||
    title.userPreferred ||
    title.romaji ||
    title.native ||
    "Untitled anime"
  );
}

export function getSecondaryTitle(title?: AnimeTitle | null): string | null {
  if (!title) return null;
  const primary = getDisplayTitle(title);
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

export function scoreLabel(value: number | null | undefined): string {
  return typeof value === "number" ? `${value}%` : "Unrated";
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
