"use client";

import { startTransition, useEffect, useState } from "react";
import type { StreamFallbackSource } from "@/types/streaming";

type StreamPlayerProps = {
  title: string;
  primaryUrl: string;
  fallbacks: StreamFallbackSource[];
};

const LOAD_TIMEOUT_MS = 8_000;

export function StreamPlayer({
  title,
  primaryUrl,
  fallbacks,
}: StreamPlayerProps) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const sources = [
    { embedUrl: primaryUrl },
    ...fallbacks.map((fallback) => ({ embedUrl: fallback.embedUrl })),
  ];
  const activeSource = sources[sourceIndex] || sources[0];
  const sourceKey = [primaryUrl, ...fallbacks.map((fallback) => fallback.embedUrl)].join(
    "|",
  );

  function switchToFallback() {
    if (sourceIndex >= sources.length - 1) {
      return;
    }

    startTransition(() => {
      setLoaded(false);
      setSourceIndex((index) => Math.min(index + 1, sources.length - 1));
    });
  }

  useEffect(() => {
    startTransition(() => {
      setSourceIndex(0);
      setLoaded(false);
    });
  }, [sourceKey]);

  useEffect(() => {
    if (loaded || sourceIndex >= sources.length - 1) {
      return;
    }

    const timer = window.setTimeout(() => {
      startTransition(() => {
        setLoaded(false);
        setSourceIndex((index) => Math.min(index + 1, sources.length - 1));
      });
    }, LOAD_TIMEOUT_MS);

    return () => window.clearTimeout(timer);
  }, [loaded, sourceIndex, sources.length]);

  return (
    <iframe
      src={activeSource.embedUrl}
      title={title}
      allow="autoplay; fullscreen; picture-in-picture"
      allowFullScreen
      referrerPolicy="no-referrer"
      onError={switchToFallback}
      onLoad={() => setLoaded(true)}
    />
  );
}
