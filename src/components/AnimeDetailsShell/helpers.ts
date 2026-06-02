import { AnimeDate, AnimeRelation } from "@/types/anime";

export function formatDate(date: AnimeDate | null): string {
  if (!date || (!date.year && !date.month && !date.day)) return "?";
  const months = [
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
  const m = date.month ? months[date.month - 1] : "";
  return [m, date.day, date.year].filter(Boolean).join(" ");
}

export function getRelatedItems(relations: AnimeRelation[]) {
  return relations.filter((item) =>
    [
      "PREQUEL",
      "SEQUEL",
      "SOURCE",
      "SIDE_STORY",
      "SUMMARY",
      "PARENT",
      "SPIN_OFF",
    ].includes(item.relationType),
  );
}
