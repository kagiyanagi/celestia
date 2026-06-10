import { headers } from "next/headers";

/**
 * In-memory sliding-window rate limiter.
 *
 * Each serverless instance maintains its own map, so the limit is enforced
 * per-instance rather than globally across the fleet. This is intentional:
 * it stops naive brute-force without requiring an external store. If
 * horizontal accuracy matters (e.g. high-traffic auth), swap the Map for a
 * Redis-backed sliding-window counter.
 *
 * The window is fixed (not truly sliding): the first request in a window
 * starts the timer, and the counter resets atomically when that timer
 * expires. This is simpler than a true sliding log and sufficient for the
 * abuse-prevention use case.
 */

type WindowState = {
  count: number;
  resetAt: number;
};

const windows = new Map<string, WindowState>();
const MAX_TRACKED_KEYS = 10_000;

export type RateLimitResult = {
  ok: boolean;
  retryAfterSeconds: number;
};

export function checkRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const state = windows.get(key);

  if (!state || state.resetAt <= now) {
    // Opportunistic cleanup so the map cannot grow unbounded.
    if (windows.size >= MAX_TRACKED_KEYS) {
      windows.forEach((value, mapKey) => {
        if (value.resetAt <= now) {
          windows.delete(mapKey);
        }
      });
    }

    windows.set(key, { count: 1, resetAt: now + options.windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  if (state.count >= options.limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((state.resetAt - now) / 1000)),
    };
  }

  state.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}

export async function getClientKey(scope: string): Promise<string> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip") ||
    "unknown";

  return `${scope}:${ip}`;
}

/**
 * Convenience guard for route handlers. Returns a 429 Response when the
 * limit is exceeded, or null when the request may proceed.
 */
export async function rateLimitResponse(
  scope: string,
  options: { limit: number; windowMs: number },
): Promise<Response | null> {
  const key = await getClientKey(scope);
  const result = checkRateLimit(key, options);

  if (result.ok) {
    return null;
  }

  return Response.json(
    { error: "Too many requests. Please try again shortly." },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    },
  );
}
