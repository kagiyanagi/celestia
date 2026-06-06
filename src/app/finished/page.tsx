import type { Metadata } from "next";

import { BrowsePageShell } from "@/components/browse-page-shell";
import { getViewerIncludesAdult } from "@/lib/auth";
import { parseBrowseParams, type BrowseSearchParams } from "@/lib/browse-filters";
import {
  getBrowseCollection,
  getBrowseFilterOptions,
} from "@/lib/providers/anilist";

export const metadata: Metadata = {
  title: "Finished"
};

type FinishedPageProps = {
  searchParams?: Promise<BrowseSearchParams>;
};

export default async function FinishedPage({ searchParams }: FinishedPageProps) {
  const params = searchParams ? await searchParams : {};
  const { filters, page } = parseBrowseParams(params);
  const includeAdult = await getViewerIncludesAdult();
  const [collection, filterOptions] = await Promise.all([
    getBrowseCollection("finished", page, filters, includeAdult),
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
