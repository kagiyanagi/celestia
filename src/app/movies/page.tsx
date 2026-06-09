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

type MoviesPageProps = {
  searchParams?: Promise<BrowseSearchParams>;
};

export async function generateMetadata({
  searchParams,
}: MoviesPageProps): Promise<Metadata> {
  const params = searchParams ? await searchParams : {};
  const { filters } = parseBrowseParams(params);
  return { title: buildBrowseMetaTitle("Movies", filters) };
}

export default async function MoviesPage({ searchParams }: MoviesPageProps) {
  const params = searchParams ? await searchParams : {};
  const { filters, page } = parseBrowseParams(params);
  const [collection, filterOptions] = await Promise.all([
    getBrowseCollection("movies", page, filters, false),
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
