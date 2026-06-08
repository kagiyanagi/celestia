import { NextResponse } from "next/server";
import { PUBLIC_LONG_CACHE } from "@/lib/http/cache";
import {
  getFranchiseGraph,
  layoutFranchiseGraph,
} from "@/lib/providers/franchise";

/**
 * Returns the laid-out franchise relation graph for an anime. Fetched lazily
 * by the details page when the Franchise tab opens, so it never slows the
 * initial render. Public catalog data, no auth.
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
    const graph = await getFranchiseGraph(animeId);
    return NextResponse.json(
      { graph: layoutFranchiseGraph(graph) },
      { headers: PUBLIC_LONG_CACHE },
    );
  } catch (error) {
    console.error("Franchise graph failed", error);
    // Fail soft: the client falls back to the flat relations list.
    return NextResponse.json({ graph: null });
  }
}
