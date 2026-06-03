import Image from "next/image";
import Link from "next/link";
import { Compass } from "lucide-react";

import { getDisplayTitle } from "@/lib/format";
import type { AnimeDetails, AnimeSummary, RelationItem } from "@/types/anime";

type TimelineEntry = {
  id: string;
  anime: AnimeSummary;
  label: string;
  href: string;
  active: boolean;
  sort: number;
};

const RELATION_ORDER: Record<string, number> = {
  SOURCE: 10,
  PARENT: 15,
  PREQUEL: 20,
  CURRENT: 30,
  SEQUEL: 40,
  SIDE_STORY: 50,
  SPIN_OFF: 55,
  SUMMARY: 60,
};

const TIMELINE_RELATIONS = new Set(Object.keys(RELATION_ORDER));

function getRelationLabel(value: string): string {
  if (value === "CURRENT") {
    return "You are here";
  }

  return value.replaceAll("_", " ").toLowerCase();
}

function getYearSort(anime: AnimeSummary): number {
  return anime.seasonYear || 9999;
}

function toTimelineEntry(relation: RelationItem): TimelineEntry | null {
  if (!TIMELINE_RELATIONS.has(relation.relationType)) {
    return null;
  }

  return {
    id: `${relation.relationType}-${relation.anime.id}`,
    anime: relation.anime,
    label: getRelationLabel(relation.relationType),
    href: `/anime/${relation.anime.id}`,
    active: false,
    sort:
      (RELATION_ORDER[relation.relationType] || 90) * 10_000 +
      getYearSort(relation.anime),
  };
}

function getTimelineEntries(anime: AnimeDetails): TimelineEntry[] {
  const current: TimelineEntry = {
    id: `current-${anime.id}`,
    anime,
    label: getRelationLabel("CURRENT"),
    href: `/anime/${anime.id}`,
    active: true,
    sort: RELATION_ORDER.CURRENT * 10_000 + getYearSort(anime),
  };
  const related = (anime.relations || [])
    .map(toTimelineEntry)
    .filter((entry): entry is TimelineEntry => Boolean(entry));

  return [current, ...related].sort((first, second) => {
    return first.sort - second.sort || first.anime.id - second.anime.id;
  });
}

export function DetailsFranchiseTimeline({ anime }: { anime: AnimeDetails }) {
  const entries = getTimelineEntries(anime);

  if (entries.length <= 1) {
    return null;
  }

  return (
    <section className="franchise-timeline" aria-label="Franchise timeline">
      <div className="franchise-timeline-head">
        <span>
          <Compass size={16} aria-hidden />
          Watch order
        </span>
        <h2>Franchise timeline</h2>
        <p>Use this path to jump between main entries and adjacent stories.</p>
      </div>

      <div className="franchise-timeline-track">
        {entries.map((entry, index) => {
          const title = getDisplayTitle(entry.anime.title);
          const content = (
            <>
              <span className="franchise-step-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="franchise-step-poster">
                {entry.anime.coverImage ? (
                  <Image
                    src={entry.anime.coverImage}
                    alt=""
                    fill
                    sizes="72px"
                  />
                ) : null}
              </span>
              <span className="franchise-step-copy">
                <small>{entry.label}</small>
                <strong>{title}</strong>
                <em>
                  {[entry.anime.format, entry.anime.seasonYear]
                    .filter(Boolean)
                    .join(" • ") || "Anime"}
                </em>
              </span>
            </>
          );

          return entry.active ? (
            <div
              className="franchise-step active"
              key={entry.id}
              aria-current="step"
            >
              {content}
            </div>
          ) : (
            <Link className="franchise-step" href={entry.href} key={entry.id}>
              {content}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
