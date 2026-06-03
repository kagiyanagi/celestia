import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AnimeCard } from "@/components/anime-card";
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
          <AnimeCard key={anime.id} anime={anime} />
        ))}
      </div>
    </section>
  );
}
