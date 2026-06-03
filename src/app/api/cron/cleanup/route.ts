import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { env } from "@/lib/env";

// Guests inactive for this long are purged along with their sessions.
const GUEST_MAX_AGE_DAYS = 14;

/**
 * Maintenance endpoint, intended for a scheduled job (e.g. Vercel cron).
 * When CRON_SECRET is set, requests must carry it as a bearer token —
 * Vercel cron does this automatically.
 */
export async function GET(request: Request) {
  if (env.cronSecret) {
    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${env.cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const cutoff = new Date(
      Date.now() - GUEST_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const removedGuests = await getStore().cleanupGuests(cutoff);

    return NextResponse.json({ removedGuests, cutoff });
  } catch (error) {
    console.error("Cleanup cron failed", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
