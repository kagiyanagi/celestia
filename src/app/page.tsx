import { AiringBoard } from "@/components/airing-board";
import { HomeHeroCarousel } from "@/components/home-hero-carousel";
import { HomeShelf } from "@/components/home-shelf";
import { HomeTrendingRail } from "@/components/home-trending-rail";
import { HomeUpcomingGrid } from "@/components/home-upcoming-grid";
import { getHomeCollections } from "@/lib/providers/anilist";

export default async function HomePage() {
  const collections = await getHomeCollections();

  return (
    <>
      <HomeHeroCarousel items={collections.topAiring} />
      <div className="page-shell">
        <HomeTrendingRail items={collections.trending} />
        <HomeUpcomingGrid items={collections.upcoming} />
        <AiringBoard items={collections.airingSoon} />
        <div className="home-shelf-row">
          <HomeShelf
            title="Just Finished"
            href="/finished"
            items={collections.finished}
          />
          <HomeShelf
            title="Top Movies"
            href="/movies"
            items={collections.movies}
          />
        </div>
      </div>
    </>
  );
}
