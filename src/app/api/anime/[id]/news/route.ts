import { NextResponse } from "next/server";

import { getAnimeMappings } from "@/lib/providers/anizip";
import { getAnimeNews } from "@/lib/providers/jikan";

/**
 * Returns recent MyAnimeList news for an anime. Fetched lazily by the details
 * page when the News tab opens, so it never slows the initial render. The MAL
 * id is resolved from the AniList id via ani.zip's mappings (cheap, cached).
 * Public catalog data, no auth.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const animeId = Number(id);

  if (!Number.isInteger(animeId) || animeId <= 0) {
    return NextResponse.json({ error: "Invalid anime id." }, { status: 400 });
  }

  try {
    const malId = (await getAnimeMappings(animeId))?.malId;

    if (!malId) {
      return NextResponse.json({ articles: [] });
    }

    const articles = await getAnimeNews(malId);
    return NextResponse.json({ articles });
  } catch (error) {
    console.error("Anime news failed", error);
    // Fail soft: the client renders an empty-news state.
    return NextResponse.json({ articles: [] });
  }
}
