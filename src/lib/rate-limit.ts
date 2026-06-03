import { headers } from "next/headers";

/**
 * In-memory sliding-window rate limiter. Per serverless instance, which
 * makes it a floor rather than a guarantee — still enough to stop naive
 * brute force. Swap the backing map for Redis when horizontal accuracy
 * matters.
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
