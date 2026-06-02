import type { Metadata } from "next";

import { BrowsePageShell } from "@/components/browse-page-shell";
import { getBrowseCollection } from "@/lib/providers/anilist";

export const metadata: Metadata = {
  title: "Upcoming"
};

export default async function UpcomingPage() {
  const items = await getBrowseCollection("upcoming");

  return (
    <BrowsePageShell
      eyebrow="next season"
      title="Top Upcoming"
      description="The most anticipated anime lined up for the next wave."
      items={items}
    />
  );
}
