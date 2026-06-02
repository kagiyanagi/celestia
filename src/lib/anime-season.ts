import type { AnimeSeason } from "@/types/anime";

export function getCurrentAnimeSeason(date = new Date()): {
  season: AnimeSeason;
  year: number;
} {
  const month = date.getUTCMonth() + 1;

  if (month <= 3) {
    return { season: "WINTER", year: date.getUTCFullYear() };
  }

  if (month <= 6) {
    return { season: "SPRING", year: date.getUTCFullYear() };
  }

  if (month <= 9) {
    return { season: "SUMMER", year: date.getUTCFullYear() };
  }

  return { season: "FALL", year: date.getUTCFullYear() };
}

export function formatSeasonLabel(season: AnimeSeason, year: number): string {
  return `${season.toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase())} ${year}`;
}
