"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { HomeTrendingRail } from "@/components/home-trending-rail";
import type { AnimeSummary } from "@/types/anime";

const SEED_STATUSES = ["completed", "watching", "rewatching"];

export function HomeRecommendations() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  // Only fetch once the user has something worth basing recommendations on,
  // mirroring the route's seed selection so we don't make an empty round-trip.
  const seedCount = (user?.libraryEntries ?? []).filter((entry) =>
    SEED_STATUSES.includes(entry.status),
  ).length;
  const [items, setItems] = useState<AnimeSummary[]>([]);

  useEffect(() => {
    if (!userId || seedCount === 0) {
      return;
    }

    const controller = new AbortController();

    fetch("/api/home/recommendations", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { items?: AnimeSummary[] } | null) => {
        if (payload?.items) {
          setItems(payload.items);
        }
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.warn("Recommendations failed", error);
        }
      });

    return () => {
      controller.abort();
    };
  }, [userId, seedCount]);

  if (!userId || seedCount === 0 || !items.length) {
    return null;
  }

  return (
    <HomeTrendingRail items={items} title="Recommended for you" href={null} />
  );
}
