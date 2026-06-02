import type { Metadata } from "next";

import { BrowsePageShell } from "@/components/browse-page-shell";
import { getBrowseCollection } from "@/lib/providers/anilist";

export const metadata: Metadata = {
  title: "Airing"
};

export default async function AiringPage() {
  const items = await getBrowseCollection("airing");

  return (
    <BrowsePageShell
      eyebrow="currently airing"
      title="Top Airing Anime"
      description="Fresh weekly shows with new episodes landing right now."
      items={items}
    />
  );
}
