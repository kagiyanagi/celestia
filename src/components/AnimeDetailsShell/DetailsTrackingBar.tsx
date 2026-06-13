"use client";

import { Plus } from "lucide-react";
import { startTransition, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import type { LibraryEntry, LibraryStatus } from "@/types/account";
import type { AnimeDetails } from "@/types/anime";

const STATUS_LABELS: Record<LibraryStatus, string> = {
  planning: "Plan to watch",
  watching: "Watching",
  on_hold: "On hold",
  dropped: "Dropped",
  completed: "Finished",
  rewatching: "Rewatching",
};

export function DetailsTrackingBar({ anime }: { anime: AnimeDetails }) {
  const { user, setUser } = useAuth();
  const [saving, setSaving] = useState(false);

  const entry = user?.libraryEntries.find((item) => item.animeId === anime.id);

  if (!user || !entry) {
    return null;
  }

  const total = anime.airingCount ?? anime.episodes ?? null;
  // Only allow +1 while there's a known episode ahead - never fabricate a
  // count past what a provider verifies (accuracy-over-fabrication rule).
  const canIncrement =
    !saving && (total == null || entry.progress < total);

  async function incrementProgress() {
    if (!entry || saving) return;
    setSaving(true);

    const nextProgress = entry.progress + 1;
    // Watching the last episode naturally completes the entry.
    const nextStatus: LibraryStatus =
      total != null && nextProgress >= total ? "completed" : entry.status;

    try {
      const response = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anime,
          status: nextStatus,
          score: entry.score,
          progress: nextProgress,
          repeat: entry.repeat,
          notes: entry.notes,
          startedAt: entry.startedAt,
          completedAt: entry.completedAt,
        }),
      });

      if (!response.ok) return;

      const payload = (await response.json()) as { entry?: LibraryEntry };
      if (payload.entry) {
        const saved = payload.entry;
        startTransition(() =>
          setUser((current) =>
            current
              ? {
                  ...current,
                  libraryEntries: [
                    ...current.libraryEntries.filter(
                      (item) => item.animeId !== saved.animeId,
                    ),
                    saved,
                  ],
                }
              : current,
          ),
        );
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="hero-tracking-bar">
      <span className="hero-tracking-status">{STATUS_LABELS[entry.status]}</span>
      <span className="hero-tracking-progress">
        {entry.progress}
        {total != null ? ` / ${total}` : ""} ep
      </span>
      {canIncrement ? (
        <button
          type="button"
          className="hero-tracking-inc"
          onClick={incrementProgress}
          disabled={saving}
          title="Mark next episode watched"
        >
          <Plus size={15} aria-hidden />
          Ep
        </button>
      ) : null}
    </div>
  );
}
