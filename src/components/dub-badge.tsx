"use client";

import { Mic } from "lucide-react";

import { useDubCount } from "@/components/dub-badge-provider";

/**
 * Card dub badge. Shows a server-provided `initial` count immediately when one
 * is known; otherwise registers the id with the `DubBadgeProvider` and hydrates
 * the count client-side after first paint. Renders nothing when the title has
 * no verifiable dub (never a guessed `0`).
 */
export function DubBadge({
  animeId,
  initial = null,
  iconSize = 12,
  withTitle = false,
  className,
}: {
  animeId: number;
  initial?: number | null;
  iconSize?: number;
  withTitle?: boolean;
  className?: string;
}) {
  const fetched = useDubCount(animeId);
  const count = initial ?? fetched;

  if (count == null) {
    return null;
  }

  return (
    <span
      {...(className ? { className } : {})}
      {...(withTitle ? { title: "Dubbed" } : {})}
    >
      <Mic size={iconSize} aria-hidden />
      {count}
    </span>
  );
}
