"use client";

import { Bookmark, BookmarkCheck, RotateCcw, Play, Pause, Ban, Check } from "lucide-react";
import { useState } from "react";
import { LibraryEntryDialog } from "@/components/library-entry-dialog";
import { useAuth } from "@/components/auth-provider";
import type { LibraryStatus } from "@/types/account";
import type { AnimeSummary } from "@/types/anime";

const statusOptions: Array<{
  value: LibraryStatus;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  { value: "planning", label: "Plan to watch", icon: Bookmark },
  { value: "watching", label: "Watching", icon: Play },
  { value: "on_hold", label: "On hold", icon: Pause },
  { value: "dropped", label: "Dropped", icon: Ban },
  { value: "completed", label: "Finished", icon: Check },
  { value: "rewatching", label: "Rewatching", icon: RotateCcw },
];

export function DetailsSaveButton({
  anime,
}: {
  anime: AnimeSummary;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const entry = user?.libraryEntries.find((item) => item.animeId === anime.id) || null;

  // Saved entries surface their list status (watching, on hold, ...) on the
  // trigger; unsaved titles get the plain bookmark.
  const TriggerIcon = entry
    ? statusOptions.find((option) => option.value === entry.status)?.icon ||
      BookmarkCheck
    : Bookmark;

  return (
    <>
      <button
        className={`hero-icon-btn ${entry ? "is-active" : ""}`}
        title={
          entry
            ? `On your list: ${statusOptions.find((option) => option.value === entry.status)?.label || "Saved"}`
            : "Save to list"
        }
        type="button"
        onClick={() => setOpen(true)}
      >
        <TriggerIcon size={20} />
      </button>

      {open ? (
        <LibraryEntryDialog anime={anime} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
