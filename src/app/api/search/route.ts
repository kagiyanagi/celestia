import { getViewerIncludesAdult } from "@/lib/auth";
import { searchAnime } from "@/lib/providers/anilist";
import { rateLimitResponse } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const limited = await rateLimitResponse("search", {
    limit: 40,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const results = await searchAnime(query, 1, await getViewerIncludesAdult());
    return NextResponse.json(results);
  } catch (error) {
    console.error("Search API Error:", error);
    return NextResponse.json({ error: "Failed to fetch results" }, { status: 500 });
  }
}
