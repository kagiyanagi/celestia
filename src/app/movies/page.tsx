import type { Metadata } from "next";

import { BrowsePageShell } from "@/components/browse-page-shell";
import { parseBrowseParams, type BrowseSearchParams } from "@/lib/browse-filters";
import {
  getBrowseCollection,
  getBrowseFilterOptions,
} from "@/lib/providers/anilist";

export const metadata: Metadata = {
  title: "Movies"
};

type MoviesPageProps = {
  searchParams?: Promise<BrowseSearchParams>;
};

export default async function MoviesPage({ searchParams }: MoviesPageProps) {
  const params = searchParams ? await searchParams : {};
  const { filters, page } = parseBrowseParams(params);
  const [collection, filterOptions] = await Promise.all([
    getBrowseCollection("movies", page, filters),
    getBrowseFilterOptions(),
  ]);

  return (
    <BrowsePageShell
      eyebrow="feature films"
      title="Top Movies"
      description="High-scoring anime films in one clean shelf."
      items={collection.items}
      pageInfo={collection.pageInfo}
      basePath="/movies"
      section="movies"
      filters={filters}
      filterOptions={filterOptions}
    />
  );
}
