"use client";

import { CalendarDays, ChevronDown, Play, RotateCcw, Trash2, Pause, Ban, Check, Bookmark } from "lucide-react";
import { startTransition, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import type { LibraryEntry, LibraryStatus } from "@/types/account";
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

function inputDateValue(value: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

export function LibraryEntryDialog({
  anime,
  onClose,
}: {
  anime: AnimeSummary;
  onClose: () => void;
}) {
  const { refreshUser, user } = useAuth();
  const [statusOpen, setStatusOpen] = useState(false);
  const [entry, setEntry] = useState<LibraryEntry | null>(
    user?.libraryEntries.find((item) => item.animeId === anime.id) || null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    status: "watching" as LibraryStatus,
    score: 0,
    progress: 0,
    repeat: 0,
    notes: "",
    startedAt: "",
    completedAt: "",
  });

  useEffect(() => {
    void fetch("/api/library", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Sign in to save to your list.");
        }

        const payload = (await response.json()) as { entries: LibraryEntry[] };
        const existing = payload.entries.find((item) => item.animeId === anime.id) || null;
        setEntry(existing);
        setForm({
          status: existing?.status || "watching",
          score: existing?.score || 0,
          progress: existing?.progress || 0,
          repeat: existing?.repeat || 0,
          notes: existing?.notes || "",
          startedAt: inputDateValue(existing?.startedAt || null),
          completedAt: inputDateValue(existing?.completedAt || null),
        });
      })
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load entry.");
      })
      .finally(() => setLoading(false));
  }, [anime.id]);

  const activeStatus = useMemo(
    () => statusOptions.find((option) => option.value === form.status) || statusOptions[1],
    [form.status],
  );

  async function saveEntry() {
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/library", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          anime,
          status: form.status,
          score: Number(form.score) || 0,
          progress: Number(form.progress) || 0,
          repeat: Number(form.repeat) || 0,
          notes: form.notes,
          startedAt: form.startedAt || null,
          completedAt: form.completedAt || null,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        entry?: LibraryEntry;
        syncWarning?: string | null;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Could not save this entry.");
      }

      await refreshUser();
      startTransition(() => {
        setEntry(payload.entry || null);
        if (payload.syncWarning) {
          setError(payload.syncWarning);
          return;
        }
        onClose();
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not save this entry.");
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry() {
    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/library?animeId=${anime.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as {
        error?: string;
        syncWarning?: string | null;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Could not remove this entry.");
      }

      await refreshUser();
      startTransition(() => {
        setEntry(null);
        if (payload.syncWarning) {
          setError(payload.syncWarning);
          return;
        }
        onClose();
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not remove this entry.");
    } finally {
      setSaving(false);
    }
  }

  if (typeof document === "undefined") {
    return null;
  }

  // Portaled to <body> so ancestor transforms (e.g. the hero carousel
  // track) can't hijack the fixed-position backdrop.
  return createPortal(
    <div className="dialog-backdrop" role="presentation" onClick={() => onClose()}>
      <div className="save-dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="save-dialog-body">
          <div className="save-dialog-head">
            {anime.coverImage ? (
              <span className="save-dialog-thumb">
                <Image src={anime.coverImage} alt="" fill sizes="64px" />
              </span>
            ) : null}
            <h2>{anime.title?.english || anime.title?.userPreferred || anime.title?.romaji || "Untitled anime"}</h2>
          </div>

          <div className="save-status-menu">
            <span>Status</span>
            <div className="save-status-dropdown">
              <button
                type="button"
                className="save-status-trigger"
                aria-haspopup="listbox"
                aria-expanded={statusOpen}
                onClick={() => setStatusOpen((current) => !current)}
              >
                {(() => {
                  const ActiveStatusIcon = activeStatus.icon;
                  return <ActiveStatusIcon size={18} />;
                })()}
                {activeStatus.label}
                <ChevronDown size={16} className="save-status-caret" />
              </button>
              {statusOpen ? (
                <>
                  <button
                    type="button"
                    className="save-status-scrim"
                    aria-label="Close status menu"
                    onClick={() => setStatusOpen(false)}
                  />
                  <div className="save-status-list" role="listbox" aria-label="Status">
                    {statusOptions.map((option) => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="option"
                          aria-selected={form.status === option.value}
                          className={form.status === option.value ? "active" : ""}
                          onClick={() => {
                            setForm((current) => ({ ...current, status: option.value }));
                            setStatusOpen(false);
                          }}
                        >
                          <Icon size={18} />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div className="save-dialog-grid">
            <label>
              Start date
              <span className="field-with-icon">
                <input
                  type="date"
                  value={form.startedAt}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      startedAt: event.target.value,
                    }))
                  }
                />
                <CalendarDays size={18} />
              </span>
            </label>
            <label>
              End date
              <span className="field-with-icon">
                <input
                  type="date"
                  value={form.completedAt}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      completedAt: event.target.value,
                    }))
                  }
                />
                <CalendarDays size={18} />
              </span>
            </label>
            <label>
              Score
              <input
                type="number"
                min="0"
                max="100"
                value={form.score}
                onChange={(event) =>
                  setForm((current) => ({ ...current, score: Number(event.target.value) }))
                }
              />
            </label>
            <label>
              Episode watched
              <input
                type="number"
                min="0"
                max={anime.episodes || undefined}
                value={form.progress}
                onChange={(event) =>
                  setForm((current) => ({ ...current, progress: Number(event.target.value) }))
                }
              />
            </label>
            <label>
              Total rewatches
              <input
                type="number"
                min="0"
                value={form.repeat}
                onChange={(event) =>
                  setForm((current) => ({ ...current, repeat: Number(event.target.value) }))
                }
              />
            </label>
          </div>

          <label className="save-dialog-notes">
            Notes
            <textarea
              rows={4}
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder="Add a note."
            />
          </label>

          {loading ? <p className="dialog-message">Loading your entry...</p> : null}
          {error ? (
            <p className="dialog-message error">
              {error}{" "}
              {error.includes("Sign in") ? (
                <Link href="/profile">Go to sign in</Link>
              ) : null}
            </p>
          ) : null}

          <div className="save-dialog-actions">
            <button
              className="danger-icon-button"
              type="button"
              onClick={() => void removeEntry()}
              disabled={saving || !entry}
              aria-label="Remove from list"
            >
              <Trash2 size={18} />
            </button>
            <div className="save-dialog-buttons">
              <button type="button" className="secondary-action" onClick={() => onClose()}>
                Cancel
              </button>
              <button type="button" className="primary-action" onClick={() => void saveEntry()} disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
