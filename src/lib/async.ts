/**
 * Bounds how long a caller waits for an optional enrichment without
 * cancelling it: on timeout the fallback is returned and the original
 * promise keeps running, so its result still lands in provider caches and
 * the next request gets the full data instantly.
 */
export function withSoftTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]);
}
