import { NextResponse } from "next/server";
import { getUserById } from "@/lib/account-store";
import { syncAniListLibrary } from "@/lib/anilist-sync";
import { requireSessionUser } from "@/lib/auth";

export async function POST() {
  try {
    const sessionUser = await requireSessionUser();
    const synced = await syncAniListLibrary(sessionUser.id, { force: true });
    const user = synced ?? (await getUserById(sessionUser.id));
    return NextResponse.json({ user, synced: Boolean(synced) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed." },
      { status: 400 },
    );
  }
}
