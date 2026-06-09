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

type FinishedPageProps = {
  searchParams?: Promise<BrowseSearchParams>;
};

export async function generateMetadata({
  searchParams,
}: FinishedPageProps): Promise<Metadata> {
  const params = searchParams ? await searchParams : {};
  const { filters } = parseBrowseParams(params);
  return { title: buildBrowseMetaTitle("Finished", filters) };
}

export default async function FinishedPage({ searchParams }: FinishedPageProps) {
  const params = searchParams ? await searchParams : {};
  const { filters, page } = parseBrowseParams(params);
  const [collection, filterOptions] = await Promise.all([
    getBrowseCollection("finished", page, filters, false),
    getBrowseFilterOptions(),
  ]);

  return (
    <BrowsePageShell
      eyebrow="completed series"
      title="Just Finished"
      description="The latest anime that recently completed their run."
      items={collection.items}
      pageInfo={collection.pageInfo}
      basePath="/finished"
      section="finished"
      filters={filters}
      filterOptions={filterOptions}
    />
  );
}
