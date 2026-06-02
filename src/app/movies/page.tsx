import type { Metadata } from "next";

import { BrowsePageShell } from "@/components/browse-page-shell";
import { parsePageParam, type PaginationSearchParams } from "@/lib/pagination";
import { getBrowseCollection } from "@/lib/providers/anilist";

export const metadata: Metadata = {
  title: "Movies"
};

type MoviesPageProps = {
  searchParams?: Promise<PaginationSearchParams>;
};

export default async function MoviesPage({ searchParams }: MoviesPageProps) {
  const params = searchParams ? await searchParams : {};
  const collection = await getBrowseCollection(
    "movies",
    parsePageParam(params.page),
  );

  return (
    <BrowsePageShell
      eyebrow="feature films"
      title="Top Movies"
      description="High-scoring anime films in one clean shelf."
      items={collection.items}
      pageInfo={collection.pageInfo}
      basePath="/movies"
    />
  );
}
