import type { Metadata } from "next";

import { BrowsePageShell } from "@/components/browse-page-shell";
import { parsePageParam, type PaginationSearchParams } from "@/lib/pagination";
import { getBrowseCollection } from "@/lib/providers/anilist";

export const metadata: Metadata = {
  title: "Trending"
};

type TrendingPageProps = {
  searchParams?: Promise<PaginationSearchParams>;
};

export default async function TrendingPage({ searchParams }: TrendingPageProps) {
  const params = searchParams ? await searchParams : {};
  const collection = await getBrowseCollection(
    "trending",
    parsePageParam(params.page),
  );

  return (
    <BrowsePageShell
      eyebrow="live chart"
      title="Trending Now"
      description="The biggest anime on the platform right now."
      items={collection.items}
      pageInfo={collection.pageInfo}
      basePath="/trending"
    />
  );
}
