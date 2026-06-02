import type { Metadata } from "next";

import { BrowsePageShell } from "@/components/browse-page-shell";
import { parsePageParam, type PaginationSearchParams } from "@/lib/pagination";
import { getBrowseCollection } from "@/lib/providers/anilist";

export const metadata: Metadata = {
  title: "Finished"
};

type FinishedPageProps = {
  searchParams?: Promise<PaginationSearchParams>;
};

export default async function FinishedPage({ searchParams }: FinishedPageProps) {
  const params = searchParams ? await searchParams : {};
  const collection = await getBrowseCollection(
    "finished",
    parsePageParam(params.page),
  );

  return (
    <BrowsePageShell
      eyebrow="completed series"
      title="Just Finished"
      description="The latest anime that recently completed their run."
      items={collection.items}
      pageInfo={collection.pageInfo}
      basePath="/finished"
    />
  );
}
