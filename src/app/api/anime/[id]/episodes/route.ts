import { NextResponse } from "next/server";

import { getAnimeDetails } from "@/lib/providers/anilist";
import {
  searchSortPageEpisodes,
  type ListEpisode,
} from "@/lib/episode-pagination";

/**
 * Paginated/searched episode list for mega-shows. The browser ships only the
 * first page for titles over the client cap and pulls further pages (and search
 * results) from here, so a 1000+ episode list never bloats the page payload.
 * Reads the same `getAnimeDetails` episode data the page rendered from (cached).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const animeId = Number(id);

  if (!Number.isInteger(animeId) || animeId <= 0) {
    return NextResponse.json(
      { episodes: [], matched: 0, total: 0 },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page")) || 1;
  const query = searchParams.get("q") ?? "";
  const order = searchParams.get("order") === "desc" ? "desc" : "asc";

  const anime = await getAnimeDetails(animeId);
  const source = anime?.streamingEpisodes ?? [];
  const limit = anime?.airingCount || source.length || undefined;

  const all: ListEpisode[] = source.slice(0, limit).map((episode) => ({
    number: episode.number,
    title: episode.title || null,
    description: episode.description || null,
    thumbnail: episode.thumbnail || null,
    airDate: episode.airDate || null,
    rating: episode.rating ?? null,
  }));

  const result = searchSortPageEpisodes(all, { query, order, page });
  return NextResponse.json({ ...result, total: all.length });
}
