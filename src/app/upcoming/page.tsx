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

type UpcomingPageProps = {
  searchParams?: Promise<BrowseSearchParams>;
};

export async function generateMetadata({
  searchParams,
}: UpcomingPageProps): Promise<Metadata> {
  const params = searchParams ? await searchParams : {};
  const { filters } = parseBrowseParams(params);
  return { title: buildBrowseMetaTitle("Upcoming", filters) };
}

export default async function UpcomingPage({ searchParams }: UpcomingPageProps) {
  const params = searchParams ? await searchParams : {};
  const { filters, page } = parseBrowseParams(params);
  const [collection, filterOptions] = await Promise.all([
    getBrowseCollection("upcoming", page, filters, false),
    getBrowseFilterOptions(),
  ]);

  return (
    <BrowsePageShell
      eyebrow="next season"
      title="Top Upcoming"
      description="The most anticipated anime lined up for the next wave."
      items={collection.items}
      pageInfo={collection.pageInfo}
      basePath="/upcoming"
      section="upcoming"
      filters={filters}
      filterOptions={filterOptions}
    />
  );
}
