import type { Metadata } from "next";

import { BrowsePageShell } from "@/components/browse-page-shell";
import {
  parseBrowseParams,
  type BrowseSearchParams,
} from "@/lib/browse-filters";
import {
  getBrowseCollection,
  getBrowseFilterOptions,
} from "@/lib/providers/anilist";

export const metadata: Metadata = {
  title: "Search",
};

export const revalidate = 900;

type SearchPageProps = {
  searchParams: Promise<BrowseSearchParams>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const { filters, page } = parseBrowseParams(params);
  const [collection, filterOptions] = await Promise.all([
    getBrowseCollection("search", page, filters, false),
    getBrowseFilterOptions(),
  ]);

  return (
    <BrowsePageShell
      eyebrow="catalog search"
      title="Global Search"
      description="Search anime by title, genres, years, and more. Find your next favorite show."
      items={collection.items}
      pageInfo={collection.pageInfo}
      basePath="/search"
      section="search"
      filters={filters}
      filterOptions={filterOptions}
      showSectionTitle={false}
    />
  );
}
