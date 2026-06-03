import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Captions, Mic, Radio, Star } from "lucide-react";

import { LibraryStatusChip } from "@/components/library-status-chip";
import { formatAnimeDate, getDisplayTitle, scoreLabel } from "@/lib/format";
import type { AnimeSummary } from "@/types/anime";

type HomeShelfProps = {
  title: string;
  href: string;
  items: AnimeSummary[];
};

export function HomeShelf({ title, href, items }: HomeShelfProps) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="home-shelf">
      <div className="home-section-head">
        <h2>{title}</h2>
        <Link href={href}>
          View all
          <ArrowRight size={16} aria-hidden />
        </Link>
      </div>

      <div className="shelf-grid">
        {items.map((anime) => {
          const airedDate = formatAnimeDate(anime.startDate);

          return (
          <Link
            className="shelf-card"
            href={`/anime/${anime.id}`}
            key={anime.id}
          >
            <span className="shelf-card-poster">
              {anime.coverImage ? (
                <Image
                  src={anime.coverImage}
                  alt=""
                  fill
                  sizes="96px"
                  className="poster-image"
                  loading="lazy"
                />
              ) : null}
            </span>

            <span className="shelf-card-copy">
              <strong>
                {anime.status === "RELEASING" && (
                  <Radio
                    size={14}
                    className="shelf-card-airing-icon"
                    aria-hidden
                  />
                )}
                {getDisplayTitle(anime.title)}
              </strong>
              <span className="shelf-card-meta">
                <span>
                  <Captions size={14} aria-hidden />
                  {anime.airingCount || 0}
                </span>
                {anime.dubCount != null ? (
                  <span>
                    <Mic size={14} aria-hidden />
                    {anime.dubCount}
                  </span>
                ) : null}
                <span>
                  <Star size={14} aria-hidden />
                  {scoreLabel(anime.averageScore)}
                </span>
                {airedDate ? (
                  <span title="Started airing">
                    <CalendarDays size={14} aria-hidden />
                    {airedDate}
                  </span>
                ) : null}
                <LibraryStatusChip animeId={anime.id} inline />
              </span>
            </span>
          </Link>
          );
        })}
      </div>
    </section>
  );
}
