import type { Metadata } from "next";

import { BrowsePageShell } from "@/components/browse-page-shell";
import { parsePageParam, type PaginationSearchParams } from "@/lib/pagination";
import { getBrowseCollection } from "@/lib/providers/anilist";

export const metadata: Metadata = {
  title: "Airing"
};

type AiringPageProps = {
  searchParams?: Promise<PaginationSearchParams>;
};

export default async function AiringPage({ searchParams }: AiringPageProps) {
  const params = searchParams ? await searchParams : {};
  const collection = await getBrowseCollection(
    "airing",
    parsePageParam(params.page),
  );

  return (
    <BrowsePageShell
      eyebrow="currently airing"
      title="Top Airing Anime"
      description="Fresh weekly shows with new episodes landing right now."
      items={collection.items}
      pageInfo={collection.pageInfo}
      basePath="/airing"
    />
  );
}
