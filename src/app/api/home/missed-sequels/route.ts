import { NextResponse } from "next/server";

import { getSessionUser, getViewerIncludesAdult } from "@/lib/auth";
import { getMissedSequels } from "@/lib/providers/anilist";

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ items: [] });
  }

  const library = user.libraryEntries ?? [];
  const includeAdult = await getViewerIncludesAdult();

  const items = await getMissedSequels(library, includeAdult);

  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
