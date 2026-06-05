"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * Resolves fallback banners (for titles AniList has none for) in batched
 * requests to `/api/banners`, off the server render path. Same pattern as
 * `DubBadgeProvider`: surfaces paint with whatever banner they have, register
 * the ids that are missing one, and swap in the resolved backdrop when it
 * arrives — so the home hero / airing board / schedule never block on the
 * per-id ani.zip/TMDB walk.
 */

const MAX_IDS_PER_REQUEST = 50;

type BannerContextValue = {
  banners: Map<number, string>;
  register: (id: number) => void;
};

const BannerContext = createContext<BannerContextValue | null>(null);

export function BannerFallbackProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [banners, setBanners] = useState<Map<number, string>>(() => new Map());
  const requestedRef = useRef<Set<number>>(new Set());
  const queueRef = useRef<Set<number>>(new Set());
  const flushScheduledRef = useRef(false);

  const flush = useCallback(async () => {
    flushScheduledRef.current = false;
    const pending = Array.from(queueRef.current);
    queueRef.current.clear();
    if (pending.length === 0) {
      return;
    }
    pending.forEach((id) => requestedRef.current.add(id));

    for (let i = 0; i < pending.length; i += MAX_IDS_PER_REQUEST) {
      const chunk = pending.slice(i, i + MAX_IDS_PER_REQUEST);
      try {
        const response = await fetch(`/api/banners?ids=${chunk.join(",")}`);
        if (!response.ok) {
          continue;
        }
        const payload = (await response.json()) as {
          banners: Record<string, string>;
        };
        setBanners((prev) => {
          const next = new Map(prev);
          for (const [id, url] of Object.entries(payload.banners)) {
            next.set(Number(id), url);
          }
          return next;
        });
      } catch {
        // Soft-fail: a missing backdrop is cosmetic, the page is unaffected.
      }
    }
  }, []);

  const register = useCallback(
    (id: number) => {
      if (
        !Number.isFinite(id) ||
        requestedRef.current.has(id) ||
        queueRef.current.has(id)
      ) {
        return;
      }
      queueRef.current.add(id);
      if (!flushScheduledRef.current) {
        flushScheduledRef.current = true;
        queueMicrotask(() => {
          void flush();
        });
      }
    },
    [flush],
  );

  return (
    <BannerContext.Provider value={{ banners, register }}>
      {children}
    </BannerContext.Provider>
  );
}

/** Raw context — for components that render many banners in a map. */
export function useBannerContext() {
  return useContext(BannerContext);
}

/** Single-item convenience: returns the initial banner, or a resolved
 *  fallback once it loads, or null. */
export function useBannerFallback(
  id: number,
  initial?: string | null,
): string | null {
  const context = useContext(BannerContext);

  useEffect(() => {
    if (!initial && id) {
      context?.register(id);
    }
  }, [context, id, initial]);

  return initial ?? context?.banners.get(id) ?? null;
}
