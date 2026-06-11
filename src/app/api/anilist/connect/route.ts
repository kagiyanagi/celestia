import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireSessionUser } from "@/lib/auth";
import { getAniListAuthorizeUrl } from "@/lib/providers/anilist";

function createState() {
  return randomBytes(24).toString("hex");
}

export async function GET() {
  try {
    await requireSessionUser();
    const state = createState();
    const cookieStore = await cookies();
    cookieStore.set("mirucast_anilist_state", state, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
    });
    return NextResponse.redirect(getAniListAuthorizeUrl(state));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AniList connection failed.";
    return NextResponse.redirect(
      new URL(`/profile?error=${encodeURIComponent(message)}`, process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
    );
  }
}
