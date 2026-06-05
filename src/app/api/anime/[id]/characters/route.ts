import { NextResponse } from "next/server";

import { getCharacterCreditsPage } from "@/lib/providers/anilist";

/**
 * Returns one character page (2..N) for the details Cast tab. The detail page
 * ships only page 1; the tab lazy-loads the rest from here after first paint,
 * mirroring how the Franchise tab loads. Public catalog data, no auth.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const animeId = Number(id);

  if (!Number.isInteger(animeId) || animeId <= 0) {
    return NextResponse.json(
      { characters: [], hasNextPage: false },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page")) || 2;

  const result = await getCharacterCreditsPage(animeId, page);
  return NextResponse.json(result);
}
