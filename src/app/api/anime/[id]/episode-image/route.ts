import { NextResponse } from "next/server";
import { PUBLIC_LONG_CACHE } from "@/lib/http/cache";
import { getAniZipEpisodes } from "@/lib/providers/anizip";

/**
 * Returns the still image for a single episode, sourced from ani.zip (TVDB),
 * whose episodes are keyed by AniList episode number and therefore
 * season-correct. Used to enrich Continue Watching / history cards whose entry
 * carries no per-episode image (e.g. AniList-synced watches). Returns
 * `{ image: null }` when no still exists so the caller keeps its fallback.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const animeId = Number(id);
  const episode = Number(new URL(request.url).searchParams.get("ep"));

  if (
    !Number.isInteger(animeId) ||
    animeId <= 0 ||
    !Number.isInteger(episode) ||
    episode <= 0
  ) {
    return NextResponse.json(
      { error: "Invalid anime id or episode." },
      { status: 400 },
    );
  }

  try {
    const episodes = await getAniZipEpisodes(animeId);
    const match = episodes.find((item) => item.number === episode);
    return NextResponse.json(
      { image: match?.thumbnail ?? null },
      { headers: PUBLIC_LONG_CACHE },
    );
  } catch (error) {
    console.error("Episode image lookup failed", error);
    // Fail soft: the card falls back to the show banner/cover.
    return NextResponse.json({ image: null });
  }
}
