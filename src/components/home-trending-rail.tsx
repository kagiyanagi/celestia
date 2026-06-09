import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AnimeCard } from "@/components/anime-card";
import type { AnimeSummary } from "@/types/anime";

type HomeTrendingRailProps = {
  items: AnimeSummary[];
  title?: string;
  href?: string | null;
};

export function HomeTrendingRail({
  items,
  title = "Trending Now",
  href = "/trending",
}: HomeTrendingRailProps) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="home-section">
      <div className="home-section-head">
        <h2>{title}</h2>
        {href ? (
          <Link href={href}>
            View all
            <ArrowRight size={18} aria-hidden />
          </Link>
        ) : null}
      </div>

      <div className="trending-rail">
        {items.map((anime) => (
          <AnimeCard key={anime.id} anime={anime} />
        ))}
      </div>
    </section>
  );
}
