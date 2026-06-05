"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { StreamAudioType } from "@/types/streaming";

/**
 * The dynamic part of a watch URL — which server, audio track, and provider
 * anime id are active. The player panel updates it when the viewer switches
 * server/audio in place; the episode browser and episode nav read it so their
 * links stay in sync with what's actually playing.
 */
export type WatchSelection = {
  server: string | null;
  audio: StreamAudioType | null;
  sid: number | null;
};

type WatchSelectionContextValue = WatchSelection & {
  setSelection: (next: Partial<WatchSelection>) => void;
};

const WatchSelectionContext =
  createContext<WatchSelectionContextValue | null>(null);

export function WatchSelectionProvider({
  initial,
  children,
}: {
  initial: WatchSelection;
  children: ReactNode;
}) {
  const [selection, setState] = useState<WatchSelection>(initial);

  const setSelection = useCallback((next: Partial<WatchSelection>) => {
    setState((prev) => ({ ...prev, ...next }));
  }, []);

  const value = useMemo(
    () => ({ ...selection, setSelection }),
    [selection, setSelection],
  );

  return (
    <WatchSelectionContext.Provider value={value}>
      {children}
    </WatchSelectionContext.Provider>
  );
}

/**
 * Returns the active selection, or null when rendered outside a watch page
 * (e.g. the details Episodes tab), so shared consumers can fall back to props.
 */
export function useWatchSelection(): WatchSelectionContextValue | null {
  return useContext(WatchSelectionContext);
}
