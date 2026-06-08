"use client";

import { useEffect, useState } from "react";

import { AiringBoard } from "@/components/airing-board";
import { HomeHeroCarousel } from "@/components/home-hero-carousel";
import { HomePersonalSections } from "@/components/home-personal-sections";
import { HomeShelf } from "@/components/home-shelf";
import { HomeTrendingRail } from "@/components/home-trending-rail";
import { HomeUpcomingGrid } from "@/components/home-upcoming-grid";
import { useAuth } from "@/components/auth-provider";
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

  return (
    <>
      <HomeHeroCarousel items={collections.topAiring.slice(0, 5)} />
      <div className="page-shell">
        <HomePersonalSections user={null} />
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
