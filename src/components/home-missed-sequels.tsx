"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { HomeTrendingRail } from "@/components/home-trending-rail";
import type { AnimeSummary } from "@/types/anime";

export function HomeMissedSequels() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const completedCount = (user?.libraryEntries ?? []).filter(
    (entry) => entry.status === "completed"
  ).length;
  const [items, setItems] = useState<AnimeSummary[]>([]);

  useEffect(() => {
    if (!userId || completedCount === 0) {
      return;
    }

    const controller = new AbortController();

    fetch("/api/home/missed-sequels", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { items?: AnimeSummary[] } | null) => {
        if (payload?.items) {
          setItems(payload.items);
        }
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.warn("Missed sequels fetch failed", error);
        }
      });

    return () => {
      controller.abort();
    };
  }, [userId, completedCount]);

  if (!userId || completedCount === 0 || !items.length) {
    return null;
  }

  return (
    <HomeTrendingRail
      items={items}
      title="Missed Sequels"
      href="/missed-sequels"
    />
  );
}
