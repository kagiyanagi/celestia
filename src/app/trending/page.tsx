import type { Metadata } from "next";

import { BrowsePageShell } from "@/components/browse-page-shell";
import { getBrowseCollection } from "@/lib/providers/anilist";

export const metadata: Metadata = {
  title: "Trending"
};

export default async function TrendingPage() {
  const items = await getBrowseCollection("trending");

  return (
    <BrowsePageShell
      eyebrow="live chart"
      title="Trending Now"
      description="The biggest anime on the platform right now."
      items={items}
    />
  );
}
