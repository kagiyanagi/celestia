import { getDubCountsByAniListIds } from "@/lib/providers/anilist";
import { rateLimitResponse } from "@/lib/rate-limit";

/**
 * Batch dub-count lookup for card badges. Card surfaces render immediately with
 * no dub data; the client `DubBadgeProvider` collects the visible AniList ids
 * and resolves their dub counts here in one request, off the render path. The
 * heavy per-id AnimeSchedule fan-out happens here (cached), never blocking a
 * page's first paint.
 */
export async function GET(request: Request) {
  const limited = await rateLimitResponse("dub-badges", {
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
    return Response.json({ counts: {} });
  }

  const counts = await getDubCountsByAniListIds(ids);
  return Response.json({ counts });
}
