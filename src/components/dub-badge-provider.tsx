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
 * Collects the AniList ids of every dub badge rendered on the page and resolves
 * their dub counts in batched requests to `/api/dub-badges`, off the server
 * render path. Mirrors the `AuthProvider`/`LibraryStatusChip` pattern: cards
 * paint instantly, then their badges hydrate when the lookup returns.
 */

const MAX_IDS_PER_REQUEST = 50;

type DubBadgeContextValue = {
  counts: Map<number, number>;
  register: (id: number) => void;
};

const DubBadgeContext = createContext<DubBadgeContextValue | null>(null);

export function DubBadgeProvider({ children }: { children: React.ReactNode }) {
  const [counts, setCounts] = useState<Map<number, number>>(() => new Map());
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
        const response = await fetch(`/api/dub-badges?ids=${chunk.join(",")}`);
        if (!response.ok) {
          continue;
        }
        const payload = (await response.json()) as {
          counts: Record<string, number>;
        };
        setCounts((prev) => {
          const next = new Map(prev);
          for (const [id, value] of Object.entries(payload.counts)) {
            next.set(Number(id), value);
          }
          return next;
        });
      } catch {
        // Soft-fail: a missing badge is fine, the rest of the page is unaffected.
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
        // Batch every badge that mounted in this tick into one request burst.
        queueMicrotask(() => {
          void flush();
        });
      }
    },
    [flush],
  );

  return (
    <DubBadgeContext.Provider value={{ counts, register }}>
      {children}
    </DubBadgeContext.Provider>
  );
}

/** Registers an id for batched lookup and returns its dub count once resolved. */
export function useDubCount(id: number): number | null {
  const context = useContext(DubBadgeContext);

  useEffect(() => {
    context?.register(id);
  }, [context, id]);

  return context?.counts.get(id) ?? null;
}
