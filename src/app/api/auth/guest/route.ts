import { initGuestSession } from "@/lib/auth";
import { rateLimitResponse } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

export async function POST() {
  const limited = await rateLimitResponse("auth:guest", {
    limit: 5,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const user = await initGuestSession();
    return NextResponse.json({ success: true, user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Guest init failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
