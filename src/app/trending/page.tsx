import type { Metadata } from "next";

import { BrowsePageShell } from "@/components/browse-page-shell";
import {
  buildBrowseMetaTitle,
  parseBrowseParams,
  type BrowseSearchParams,
} from "@/lib/browse-filters";
import {
  getBrowseCollection,
  getBrowseFilterOptions,
} from "@/lib/providers/anilist";

export const revalidate = 900;

type TrendingPageProps = {
  searchParams?: Promise<BrowseSearchParams>;
};

export async function generateMetadata({
  searchParams,
}: TrendingPageProps): Promise<Metadata> {
  const params = searchParams ? await searchParams : {};
  const { filters } = parseBrowseParams(params);
  return { title: buildBrowseMetaTitle("Trending", filters) };
}

export default async function TrendingPage({ searchParams }: TrendingPageProps) {
  const params = searchParams ? await searchParams : {};
  const { filters, page } = parseBrowseParams(params);
  const [collection, filterOptions] = await Promise.all([
    getBrowseCollection("trending", page, filters, false),
    getBrowseFilterOptions(),
  ]);

  return (
    <BrowsePageShell
      eyebrow="live chart"
      title="Trending Now"
      description="The biggest anime on the platform right now."
      items={collection.items}
      pageInfo={collection.pageInfo}
      basePath="/trending"
      section="trending"
      filters={filters}
      filterOptions={filterOptions}
    />
  );
}
