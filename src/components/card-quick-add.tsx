"use client";

import { Ban, Bookmark, Check, Pause, Play, Plus, RotateCcw } from "lucide-react";
import { type MouseEvent, startTransition, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast-provider";
import type { LibraryEntry, LibraryStatus } from "@/types/account";
import type { AnimeSummary } from "@/types/anime";

const STATUS_OPTIONS: Array<{
  value: LibraryStatus;
  label: string;
  icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
}> = [
  { value: "planning", label: "Plan", icon: Bookmark },
  { value: "watching", label: "Watching", icon: Play },
  { value: "on_hold", label: "On hold", icon: Pause },
  { value: "completed", label: "Finished", icon: Check },
  { value: "dropped", label: "Dropped", icon: Ban },
  { value: "rewatching", label: "Rewatch", icon: RotateCcw },
];

/**
 * Hover-revealed quick-add control for an anime card. Sets a library status in
 * one click without opening the full edit dialog, reusing /api/library. Lives
 * inside the card <Link>, so every interaction stops navigation.
 */
export function CardQuickAdd({ anime }: { anime: AnimeSummary }) {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const entry = user?.libraryEntries.find((item) => item.animeId === anime.id);

  function swallow(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  async function setStatus(status: LibraryStatus, event: MouseEvent) {
    swallow(event);
    if (saving || !user) {
      return;
    }
    setSaving(true);

    try {
      const response = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anime,
          status,
          score: entry?.score || 0,
          progress: entry?.progress || 0,
          repeat: entry?.repeat || 0,
          notes: entry?.notes || "",
          startedAt: entry?.startedAt || null,
          completedAt: entry?.completedAt || null,
        }),
      });
      const payload = (await response.json()) as { entry?: LibraryEntry };

      if (response.ok && payload.entry) {
        const saved = payload.entry;
        startTransition(() => {
          setUser(
            user
              ? {
                  ...user,
                  libraryEntries: [
                    ...user.libraryEntries.filter(
                      (item) => item.animeId !== saved.animeId,
                    ),
                    saved,
                  ],
                }
              : user,
          );
        });
        toast({ type: "success", message: `Added to ${STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}.` });
      }
    } catch {
      toast({ type: "error", message: "Couldn't update your list. Try again." });
    } finally {
      setSaving(false);
      setOpen(false);
    }
  }

  if (!user) {
    return null;
  }

  return (
    <span className={`card-quick-add${open ? " open" : ""}`}>
      <button
        type="button"
        className="card-quick-add-trigger"
        aria-label={entry ? "Change list status" : "Add to your list"}
        aria-expanded={open}
        onClick={(event) => {
          swallow(event);
          setOpen((current) => !current);
        }}
      >
        <Plus size={15} aria-hidden />
      </button>

      {open ? (
        <span className="card-quick-add-menu" role="menu">
          {STATUS_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = entry?.status === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitem"
                className={active ? "active" : ""}
                disabled={saving}
                onClick={(event) => void setStatus(option.value, event)}
              >
                <Icon size={13} aria-hidden />
                {option.label}
              </button>
            );
          })}
        </span>
      ) : null}
    </span>
  );
}
