"use client";

import { useEffect, useState } from "react";
import { formatCountdownSeconds } from "@/lib/format";

/**
 * Minute-accurate countdown to an absolute airing timestamp. Renders the
 * provider-supplied fallback until mounted (keeps SSR pure), then re-derives
 * from the wall clock every minute.
 */
export function AiringCountdown({
  airingAt,
  fallbackSeconds,
}: {
  airingAt: number;
  fallbackSeconds: number;
}) {
  const [nowSeconds, setNowSeconds] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNowSeconds(Math.floor(Date.now() / 1000));

    update();
    const interval = window.setInterval(update, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <>
      {formatCountdownSeconds(
        nowSeconds === null ? fallbackSeconds : airingAt - nowSeconds,
      )}
    </>
  );
}
