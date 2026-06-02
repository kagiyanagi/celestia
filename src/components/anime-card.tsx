import Image from "next/image";
import Link from "next/link";
import { Captions, Mic } from "lucide-react";

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
          <span className="poster-fallback">Celstia</span>
        )}

        <span className="poster-stats">
          <span className="score-chip">{scoreLabel(anime.averageScore)}</span>
          <span className="card-episode-counts">
            <span title="Airing/Sub">
              <Captions size={12} aria-hidden />
              {anime.airingCount || 0}
            </span>
            <span title="Dubbed">
              <Mic size={12} aria-hidden />
              {anime.dubCount || 0}
            </span>
          </span>
        </span>
      </span>

      <span className="anime-card-body">
        <span className="anime-card-meta-top">
          <span>
            {anime.format === "TV" ? "TV Show" : anime.format || "Anime"}
          </span>
          <span>{anime.seasonYear || "Now"}</span>
        </span>
        <span className="anime-card-title">{title}</span>
      </span>
    </Link>
  );
}
