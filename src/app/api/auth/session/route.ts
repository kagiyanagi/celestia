import { NextResponse, after } from "next/server";
import { syncAniListLibrary } from "@/lib/anilist-sync";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ user: null });
  }

  // Return the local user immediately — this endpoint is hit on every home
  // mount and tab refocus, so it must never block on a remote AniList round
  // trip. The freshness-guarded pull runs in the background; its result lands
  // in the store and surfaces on the next refresh.
  after(() => {
    void syncAniListLibrary(user.id);
  });

  return NextResponse.json({ user });
}
