import type { Metadata } from "next";

import { BrowsePageShell } from "@/components/browse-page-shell";
import { parseBrowseParams, type BrowseSearchParams } from "@/lib/browse-filters";
import {
  getBrowseCollection,
  getBrowseFilterOptions,
} from "@/lib/providers/anilist";

export const metadata: Metadata = {
  title: "Airing"
};

type AiringPageProps = {
  searchParams?: Promise<BrowseSearchParams>;
};

export default async function AiringPage({ searchParams }: AiringPageProps) {
  const params = searchParams ? await searchParams : {};
  const { filters, page } = parseBrowseParams(params);
  const [collection, filterOptions] = await Promise.all([
    getBrowseCollection("airing", page, filters),
    getBrowseFilterOptions(),
  ]);

  return (
    <BrowsePageShell
      eyebrow="currently airing"
      title="Top Airing Anime"
      description="Fresh weekly shows with new episodes landing right now."
      items={collection.items}
      pageInfo={collection.pageInfo}
      basePath="/airing"
      section="airing"
      filters={filters}
      filterOptions={filterOptions}
    />
  );
}
