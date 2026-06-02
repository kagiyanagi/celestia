import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Captions, Mic } from "lucide-react";

import { getDisplayTitle } from "@/lib/format";
import type { AnimeSummary } from "@/types/anime";

type HomeTrendingRailProps = {
  items: AnimeSummary[];
};

export function HomeTrendingRail({ items }: HomeTrendingRailProps) {
  return (
    <section className="home-section">
      <div className="home-section-head">
        <h2>Trending Now</h2>
        <Link href="/trending">
          View all
          <ArrowRight size={18} aria-hidden />
        </Link>
      </div>

      <div className="trending-rail">
        {items.map((anime) => (
          <Link
            className="trending-card"
            href={`/anime/${anime.id}`}
            key={anime.id}
          >
            <span className="trending-poster">
              {anime.coverImage ? (
                <Image
                  src={anime.coverImage}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 42vw, 210px"
                  className="poster-image"
                  loading="lazy"
                />
              ) : null}
              <span className="trending-stats">
                <span>
                  <Captions size={12} aria-hidden />
                  {anime.airingCount || 0}
                </span>
                <span>
                  <Mic size={12} aria-hidden />
                  {anime.dubCount || 0}
                </span>
              </span>
            </span>
            <span className="trending-meta">
              <span>
                {anime.format === "TV" ? "TV Show" : anime.format || "Anime"}
              </span>
              <span>{anime.seasonYear || "Now"}</span>
            </span>
            <span className="trending-title">
              <i />
              {getDisplayTitle(anime.title)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
