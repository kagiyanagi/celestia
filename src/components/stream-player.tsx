"use client";

import { startTransition, useEffect, useState } from "react";
import type {
  StreamFallbackSource,
  StreamReferrerPolicy,
} from "@/types/streaming";

type StreamPlayerProps = {
  title: string;
  primaryUrl: string;
  primaryReferrerPolicy?: StreamReferrerPolicy;
  fallbacks: StreamFallbackSource[];
};

const DEFAULT_REFERRER_POLICY: StreamReferrerPolicy = "no-referrer";
const LOAD_TIMEOUT_MS = 8_000;

export function StreamPlayer({
  title,
  primaryUrl,
  primaryReferrerPolicy,
  fallbacks,
}: StreamPlayerProps) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const sources = [
    { embedUrl: primaryUrl, referrerPolicy: primaryReferrerPolicy },
    ...fallbacks.map((fallback) => ({
      embedUrl: fallback.embedUrl,
      referrerPolicy: fallback.referrerPolicy,
    })),
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
      referrerPolicy={activeSource.referrerPolicy ?? DEFAULT_REFERRER_POLICY}
      onError={switchToFallback}
      onLoad={() => setLoaded(true)}
    />
  );
}
