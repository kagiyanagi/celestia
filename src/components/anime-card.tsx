"use client";

import Image from "next/image";
import Link from "next/link";
import { Captions, Clock, Radio, Star, Tv } from "lucide-react";

import { CardQuickAdd } from "@/components/card-quick-add";
import { DubBadge } from "@/components/dub-badge";
import { LibraryStatusChip } from "@/components/library-status-chip";
import { useTitleLanguage } from "@/components/use-title-language";
import { getDisplayTitle, scoreLabel } from "@/lib/format";
import type { AnimeSummary } from "@/types/anime";

type AnimeCardProps = {
  anime: AnimeSummary;
  priority?: boolean;
  variant?: "grid" | "list";
};

function formatLabel(format?: string | null): string {
  if (!format) return "Anime";
  if (format === "TV") return "TV Show";
  if (format === "TV_SHORT") return "TV Short";
  return format;
}

function stripDescription(value?: string | null): string {
  if (!value) return "";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function AnimeCard({
  anime,
  priority = false,
  variant = "grid",
}: AnimeCardProps) {
  const title = getDisplayTitle(anime.title, useTitleLanguage());
  const isList = variant === "list";

  const stats = (
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
  );

  return (
    <Link
      className={isList ? "anime-card list" : "anime-card"}
      href={`/anime/${anime.id}`}
    >
      <span className="poster-shell">
        {anime.coverImage ? (
          <Image
            src={anime.coverImage}
            alt=""
            fill
            priority={priority}
            loading={priority ? undefined : "lazy"}
            sizes={isList ? "120px" : "(max-width: 768px) 45vw, 240px"}
            className="poster-image"
          />
        ) : (
          <span className="poster-fallback">MiruCast</span>
        )}
        <LibraryStatusChip animeId={anime.id} />
        <CardQuickAdd anime={anime} />
      </span>

      <span className="anime-card-body">
        <span className="anime-card-meta-top">
          <span>{formatLabel(anime.format)}</span>
          <span>{anime.seasonYear || "Now"}</span>
        </span>
        <span className="anime-card-title">
          {anime.status === "RELEASING" && (
            <Radio size={14} className="anime-card-airing-icon" aria-hidden />
          )}
          {title}
        </span>

        {isList ? (
          <span className="anime-card-detail-meta">
            {anime.episodes ? (
              <span title="Episodes">
                <Tv size={12} aria-hidden />
                {anime.episodes} ep
              </span>
            ) : null}
            {anime.duration ? (
              <span title="Episode length">
                <Clock size={12} aria-hidden />
                {anime.duration}m
              </span>
            ) : null}
          </span>
        ) : null}

        {stats}

        {isList && anime.genres?.length ? (
          <span className="anime-card-genres">
            {anime.genres.slice(0, 4).map((genre) => (
              <span className="anime-card-genre" key={genre}>
                {genre}
              </span>
            ))}
          </span>
        ) : null}

        {isList && anime.description ? (
          <span className="anime-card-desc">
            {stripDescription(anime.description)}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
