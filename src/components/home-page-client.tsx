"use client";

import { useEffect, useState } from "react";

import { AiringBoard } from "@/components/airing-board";
import { HomeGenreChips } from "@/components/home-genre-chips";
import { HomeHeroCarousel } from "@/components/home-hero-carousel";
import { HomePersonalSections } from "@/components/home-personal-sections";
import { HomeRecommendations } from "@/components/home-recommendations";
import { HomeMissedSequels } from "@/components/home-missed-sequels";
import { HomeShelf } from "@/components/home-shelf";
import { HomeTrendingRail } from "@/components/home-trending-rail";
import { HomeUpcomingGrid } from "@/components/home-upcoming-grid";
import { useAuth } from "@/components/auth-provider";
import { getCurrentAnimeSeason, formatSeasonLabel } from "@/lib/anime-season";
import { buildBrowseHref, EMPTY_BROWSE_FILTERS } from "@/lib/browse-filters";
import type { HomeCollections } from "@/types/anime";

type HomePageClientProps = {
  initialCollections: HomeCollections;
};

export function HomePageClient({ initialCollections }: HomePageClientProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const includeAdult = Boolean(user && !user.preferences.hideAdultContent);
  const [personalized, setPersonalized] = useState<{
    userId: string;
    collections: HomeCollections;
  } | null>(null);

  useEffect(() => {
    if (!userId || !includeAdult) {
      return;
    }

    const controller = new AbortController();

    fetch("/api/home", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { collections?: HomeCollections } | null) => {
        if (payload?.collections) {
          setPersonalized({
            userId,
            collections: payload.collections,
          });
        }
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.warn("Personalized home collections failed", error);
        }
      });

    return () => {
      controller.abort();
    };
  }, [includeAdult, userId]);

  const collections =
    includeAdult && personalized?.userId === userId
      ? personalized.collections
      : initialCollections;

  const currentSeason = getCurrentAnimeSeason();
  const seasonHref = buildBrowseHref("/trending", {
    ...EMPTY_BROWSE_FILTERS,
    season: currentSeason.season,
    yearMin: String(currentSeason.year),
    yearMax: String(currentSeason.year),
  });

  return (
    <>
      <HomeHeroCarousel
        items={collections.topAiring.slice(0, 5)}
      />
      <div className="page-shell">
        <HomePersonalSections user={null} />
        <HomeGenreChips />
        <HomeRecommendations />
        <HomeMissedSequels />
        <HomeTrendingRail items={collections.trending} />
        <HomeTrendingRail
          items={collections.season}
          title={formatSeasonLabel(currentSeason.season, currentSeason.year)}
          href={seasonHref}
        />
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
