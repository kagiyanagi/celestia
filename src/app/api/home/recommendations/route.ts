import { NextResponse } from "next/server";

import { getLibraryEntries } from "@/lib/account-store";
import { getSessionUser, getViewerIncludesAdult } from "@/lib/auth";
import { getRecommendationsFromSeeds } from "@/lib/providers/anilist";

// Statuses that signal genuine taste — planning entries are intent, not a
// watched signal, so they don't seed recommendations.
const SEED_STATUSES = ["completed", "watching", "rewatching"];

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ items: [] });
  }

  const library = await getLibraryEntries(user.id);
  const seedIds = library
    .filter((entry) => SEED_STATUSES.includes(entry.status))
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 20)
    .map((entry) => entry.animeId);

  if (!seedIds.length) {
    return NextResponse.json({ items: [] });
  }

  const items = await getRecommendationsFromSeeds(seedIds, {
    excludeIds: library.map((entry) => entry.animeId),
    includeAdult: await getViewerIncludesAdult(),
    limit: 24,
  });

  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
