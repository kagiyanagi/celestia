import Image from "next/image";
import Link from "next/link";
import { Captions, Radio, Star } from "lucide-react";

import { DubBadge } from "@/components/dub-badge";
import { LibraryStatusChip } from "@/components/library-status-chip";
import { getDisplayTitle, scoreLabel } from "@/lib/format";
import type { AnimeSummary } from "@/types/anime";

type AnimeCardProps = {
  anime: AnimeSummary;
  priority?: boolean;
};

export function AnimeCard({ anime, priority = false }: AnimeCardProps) {
  const title = getDisplayTitle(anime.title);

  return (
    <Link className="anime-card" href={`/anime/${anime.id}`}>
      <span className="poster-shell">
        {anime.coverImage ? (
          <Image
            src={anime.coverImage}
            alt=""
            fill
            priority={priority}
            loading={priority ? undefined : "lazy"}
            sizes="(max-width: 768px) 45vw, 240px"
            className="poster-image"
          />
        ) : (
          <span className="poster-fallback">Celestia</span>
        )}
        <LibraryStatusChip animeId={anime.id} />
      </span>

      <span className="anime-card-body">
        <span className="anime-card-meta-top">
          <span>
            {anime.format === "TV" ? "TV Show" : anime.format || "Anime"}
          </span>
          <span>{anime.seasonYear || "Now"}</span>
        </span>
        <span className="anime-card-title">
          {anime.status === "RELEASING" && (
            <Radio size={14} className="anime-card-airing-icon" aria-hidden />
          )}
          {title}
        </span>
        <span className="anime-card-stats">
          <span title="Score">
            <Star size={12} aria-hidden />
            {scoreLabel(anime.averageScore)}
          </span>
          {anime.airingCount != null ? (
            <span title="Airing/Sub">
              <Captions size={12} aria-hidden />
              {anime.airingCount}
            </span>
          ) : null}
          <DubBadge animeId={anime.id} initial={anime.dubCount ?? null} withTitle />
        </span>
      </span>
    </Link>
  );
}
