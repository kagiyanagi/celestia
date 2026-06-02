import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { setAniListConnection } from "@/lib/account-store";
import {
  exchangeAniListCode,
  getAniListViewerLibrary,
  getAniListViewerProfile,
} from "@/lib/providers/anilist";

function appOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser();
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const cookieStore = await cookies();
    const expectedState = cookieStore.get("celestia_anilist_state")?.value;

    if (!code || !state || state !== expectedState) {
      throw new Error("Invalid AniList callback state.");
    }

    cookieStore.delete("celestia_anilist_state");

    const accessToken = await exchangeAniListCode(code);
    const profile = await getAniListViewerProfile(accessToken);
    const libraryEntries = await getAniListViewerLibrary(accessToken, profile.id);

    await setAniListConnection({
      userId: user.id,
      accessToken,
      profile,
      libraryEntries,
    });

    return NextResponse.redirect(new URL("/profile?connected=1", appOrigin()));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AniList connection failed.";
    return NextResponse.redirect(
      new URL(`/profile?error=${encodeURIComponent(message)}`, appOrigin()),
    );
  }
}
