import type { Metadata } from "next";

import { BrowsePageShell } from "@/components/browse-page-shell";
import { getBrowseCollection } from "@/lib/providers/anilist";

export const metadata: Metadata = {
  title: "Movies"
};

export default async function MoviesPage() {
  const items = await getBrowseCollection("movies");

  return (
    <BrowsePageShell
      eyebrow="feature films"
      title="Top Movies"
      description="High-scoring anime films in one clean shelf."
      items={items}
    />
  );
}
