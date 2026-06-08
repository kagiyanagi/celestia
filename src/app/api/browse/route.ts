import { NextResponse } from "next/server";

import {
  parseBrowseParams,
  type BrowseSearchParams,
} from "@/lib/browse-filters";
import { getViewerIncludesAdult } from "@/lib/auth";
import { getBrowseCollection } from "@/lib/providers/anilist";
import type { BrowseSectionKey } from "@/types/anime";

const BROWSE_SECTIONS = new Set<BrowseSectionKey>([
  "airing",
  "trending",
  "upcoming",
  "finished",
  "movies",
  "search",
]);

function toBrowseParams(searchParams: URLSearchParams): BrowseSearchParams {
  const params: BrowseSearchParams = {};

  searchParams.forEach((value, key) => {
    if (key !== "section") {
      params[key as keyof BrowseSearchParams] = value;
    }
  });

  return params;
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const section = searchParams.get("section") as BrowseSectionKey | null;

  if (!section || !BROWSE_SECTIONS.has(section)) {
    return NextResponse.json(
      { error: "Invalid browse section." },
      { status: 400 },
    );
  }

  const { filters, page } = parseBrowseParams(toBrowseParams(searchParams));
  const collection = await getBrowseCollection(
    section,
    page,
    filters,
    await getViewerIncludesAdult(),
  );

  return NextResponse.json(
    { collection },
    {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    },
  );
}
