import { NextResponse } from "next/server";

import { getViewerIncludesAdult } from "@/lib/auth";
import { getHomeCollections } from "@/lib/providers/anilist";

export async function GET() {
  const collections = await getHomeCollections(await getViewerIncludesAdult());

  return NextResponse.json(
    { collections },
    {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    },
  );
}
