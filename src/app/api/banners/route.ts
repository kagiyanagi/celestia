import { NextResponse } from "next/server";

import { PUBLIC_LONG_CACHE } from "@/lib/http/cache";
import { getBannerFallbacksByIds } from "@/lib/providers/banner";
import { rateLimitResponse } from "@/lib/rate-limit";

/**
 * Batch fallback-banner lookup for surfaces that render a backdrop (home hero,
 * airing board, schedule). Those pages render immediately with whatever banner
 * AniList provided; the client `BannerFallbackProvider` resolves the missing
 * ones here in one request, off the render path. The per-id ani.zip/TMDB walk
 * happens here (cached), never blocking first paint.
 */
export async function GET(request: Request) {
  const limited = await rateLimitResponse("banners", {
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) {
    return limited;
  }

  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get("ids") ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
    .slice(0, 50);

  if (ids.length === 0) {
    return NextResponse.json({ banners: {} });
  }

  const banners = await getBannerFallbacksByIds(ids);
  return NextResponse.json({ banners }, { headers: PUBLIC_LONG_CACHE });
}
