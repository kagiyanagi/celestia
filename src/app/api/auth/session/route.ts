import { NextResponse } from "next/server";
import { syncAniListLibrary } from "@/lib/anilist-sync";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ user: null });
  }

  // Freshness-guarded pull so navigation/refresh reflects AniList edits.
  const synced = await syncAniListLibrary(user.id);
  return NextResponse.json({ user: synced ?? user });
}
