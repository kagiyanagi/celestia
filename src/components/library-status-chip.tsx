"use client";

import { Ban, Bookmark, Check, Pause, Play, RotateCcw } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import type { LibraryStatus } from "@/types/account";

const STATUS_META: Record<
  LibraryStatus,
  { label: string; icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }> }
> = {
  planning: { label: "Planning", icon: Bookmark },
  watching: { label: "Watching", icon: Play },
  on_hold: { label: "On hold", icon: Pause },
  dropped: { label: "Dropped", icon: Ban },
  completed: { label: "Finished", icon: Check },
  rewatching: { label: "Rewatching", icon: RotateCcw },
};

/**
 * Small badge showing the viewer's list status for an anime. Renders nothing
 * when the title is not on their list. Pass `status` to skip the lookup when
 * the entry is already known (e.g. the watchlist page).
 */
export function LibraryStatusChip({
  animeId,
  status,
  inline = false,
}: {
  animeId?: number;
  status?: LibraryStatus;
  inline?: boolean;
}) {
  const { user } = useAuth();
  const resolvedStatus =
    status ||
    user?.libraryEntries.find((entry) => entry.animeId === animeId)?.status;
  const meta = resolvedStatus ? STATUS_META[resolvedStatus] : null;

  if (!meta) {
    return null;
  }

  const Icon = meta.icon;

  return (
    <span className={inline ? "library-status-chip inline" : "library-status-chip"}>
      <Icon size={11} aria-hidden />
      {meta.label}
    </span>
  );
}
