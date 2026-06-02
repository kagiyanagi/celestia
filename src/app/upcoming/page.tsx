import type { Metadata } from "next";

import { BrowsePageShell } from "@/components/browse-page-shell";
import { parsePageParam, type PaginationSearchParams } from "@/lib/pagination";
import { getBrowseCollection } from "@/lib/providers/anilist";

export const metadata: Metadata = {
  title: "Upcoming"
};

type UpcomingPageProps = {
  searchParams?: Promise<PaginationSearchParams>;
};

export default async function UpcomingPage({ searchParams }: UpcomingPageProps) {
  const params = searchParams ? await searchParams : {};
  const collection = await getBrowseCollection(
    "upcoming",
    parsePageParam(params.page),
  );

  return (
    <BrowsePageShell
      eyebrow="next season"
      title="Top Upcoming"
      description="The most anticipated anime lined up for the next wave."
      items={collection.items}
      pageInfo={collection.pageInfo}
      basePath="/upcoming"
    />
  );
}
