import { NextResponse } from "next/server";
import { getEpisodeList } from "@/lib/providers/anilist";
import { PUBLIC_LONG_CACHE } from "@/lib/http/cache";

/**
 * Returns the full list of episodes for a single anime, carrying their
 * descriptive titles, descriptions, thumbnails, and other catalog metadata.
 * Sourced from the server cache (which merges AniList + AniZip + Kitsu). Uses
 * the lightweight getEpisodeList rather than the full getAnimeDetails - this
 * endpoint only needs episodes, not Jikan ratings / dub status / banner.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const animeId = Number(id);

  if (!Number.isInteger(animeId) || animeId <= 0) {
    return NextResponse.json(
      { error: "Invalid anime id." },
      { status: 400 },
    );
  }

  try {
    const episodes = await getEpisodeList(animeId);

    return NextResponse.json(
      {
        episodes: episodes.map((ep) => ({
          number: ep.number,
          title: ep.title || null,
          thumbnail: ep.thumbnail || null,
          description: ep.description || null,
          airDate: ep.airDate || null,
          rating: ep.rating || null,
        })),
      },
      { headers: PUBLIC_LONG_CACHE },
    );
  } catch (error) {
    console.error("Episodes metadata lookup failed", error);
    return NextResponse.json({ episodes: [] });
  }
}
