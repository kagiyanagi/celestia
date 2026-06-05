"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import type { AnimeSummary } from "@/types/anime";

const TICK_MS = 5_000;
// Don't nag if the viewer only glanced at the episode — they clearly didn't
// watch it. Below this, leaving is silent and nothing is recorded.
const MIN_WATCH_SECONDS = 15;

type PendingExit =
  | { kind: "href"; href: string }
  | { kind: "back" };

/**
 * Confirms whether an episode counts as watched *before* recording it, instead
 * of assuming a watch the moment the page opens. Watch time is measured while
 * the tab is visible (the player is a cross-origin embed, so true position is
 * unreadable). When the viewer leaves the episode — an in-app link, the browser
 * back button, switching episodes, going home — a small dialog asks whether to
 * mark it watched. Only on confirmation does it post to /api/history, which
 * bumps the library and syncs AniList. Server/audio swaps stay on the same
 * episode and never prompt.
 */
export function WatchCompletionPrompt({
  anime,
  episode,
  episodeTitle,
  episodeImage,
  durationLabel,
  hasSource,
}: {
  anime: AnimeSummary;
  episode: number;
  episodeTitle: string;
  episodeImage: string | null;
  durationLabel: string | null;
  hasSource: boolean;
}) {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [promptMinutes, setPromptMinutes] = useState(0);

  // Event handlers run outside React's render, so the values they read live in
  // refs to stay current without re-binding listeners.
  const watchedRef = useRef(0);
  const resolvedRef = useRef(false);
  const openRef = useRef(false);
  const armedRef = useRef(false);
  const bypassPopRef = useRef(false);
  const pendingRef = useRef<PendingExit | null>(null);

  function openDialog() {
    setPromptMinutes(Math.floor(watchedRef.current / 60));
    openRef.current = true;
    setOpen(true);
  }

  useEffect(() => {
    if (!hasSource) {
      return;
    }

    // Per-episode mount: a route navigation to a new episode remounts this.
    watchedRef.current = 0;
    resolvedRef.current = false;
    armedRef.current = false;
    bypassPopRef.current = false;
    pendingRef.current = null;

    function eligible(): boolean {
      return (
        !resolvedRef.current &&
        !openRef.current &&
        watchedRef.current >= MIN_WATCH_SECONDS
      );
    }

    function isSameEpisode(url: URL): boolean {
      if (url.pathname !== `/watch/${anime.id}`) {
        return false;
      }
      const epParam = url.searchParams.get("ep");
      const targetEp = epParam ? Number(epParam) : 1;
      return targetEp === episode;
    }

    // Arm a same-URL history entry so the browser back button fires popstate
    // while we stay on the page, giving us a chance to prompt.
    function arm() {
      if (armedRef.current) {
        return;
      }
      armedRef.current = true;
      window.history.pushState(null, "", window.location.href);
    }

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || !eligible()) {
        return;
      }
      // Let modified clicks (new tab/window, middle-click) behave normally.
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) {
        return;
      }
      const rawHref = anchor.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#")) {
        return;
      }
      if (anchor.target && anchor.target !== "_self") {
        return;
      }

      let url: URL;
      try {
        url = new URL(rawHref, window.location.href);
      } catch {
        return;
      }
      // External links (e.g. attribution) leave the app entirely — let them go.
      if (url.origin !== window.location.origin) {
        return;
      }
      // Staying on the same episode (server/audio fallback link) isn't leaving.
      if (isSameEpisode(url)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      pendingRef.current = {
        kind: "href",
        href: url.pathname + url.search + url.hash,
      };
      openDialog();
    }

    function onPopState() {
      if (bypassPopRef.current) {
        bypassPopRef.current = false;
        return;
      }
      if (!armedRef.current) {
        return;
      }
      // The back press just consumed our sentinel entry; we're still on the
      // watch page (same URL).
      armedRef.current = false;

      if (resolvedRef.current || watchedRef.current < MIN_WATCH_SECONDS) {
        // Nothing to ask — carry the viewer through to the real previous page.
        bypassPopRef.current = true;
        window.history.back();
        return;
      }

      pendingRef.current = { kind: "back" };
      openDialog();
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }
      watchedRef.current += TICK_MS / 1000;
      if (watchedRef.current >= MIN_WATCH_SECONDS) {
        arm();
      }
    }, TICK_MS);

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [anime.id, episode, hasSource]);

  function continueExit() {
    const pending = pendingRef.current;
    pendingRef.current = null;
    openRef.current = false;
    setOpen(false);

    if (!pending) {
      return;
    }
    if (pending.kind === "back") {
      bypassPopRef.current = true;
      window.history.back();
      return;
    }
    router.push(pending.href);
  }

  async function markWatched() {
    setSaving(true);
    try {
      await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anime,
          episode,
          episodeTitle,
          episodeImage,
          durationLabel,
          progressPercent: 100,
          progressOnly: false,
        }),
      });
      await refreshUser();
    } catch {
      // A failed save shouldn't trap the viewer on the page.
    } finally {
      resolvedRef.current = true;
      setSaving(false);
      continueExit();
    }
  }

  function skipWatched() {
    resolvedRef.current = true;
    continueExit();
  }

  function cancelExit() {
    // The viewer wants to stay — drop the pending exit and re-arm the back
    // guard so a later back press is caught again.
    pendingRef.current = null;
    openRef.current = false;
    setOpen(false);
    if (!armedRef.current && !resolvedRef.current) {
      armedRef.current = true;
      window.history.pushState(null, "", window.location.href);
    }
  }

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="dialog-backdrop" role="presentation" onClick={cancelExit}>
      <div
        className="save-dialog watch-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Mark episode as watched"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="save-dialog-body">
          <h2>Mark as watched?</h2>
          <p className="watch-confirm-text">
            Did you finish episode {episode}
            {episodeTitle ? ` — ${episodeTitle}` : ""}?
            {promptMinutes > 0
              ? ` You've spent about ${promptMinutes} min on it.`
              : ""}{" "}
            We&apos;ll only update your progress if you say so.
          </p>
          <div className="save-dialog-buttons">
            <button
              type="button"
              className="secondary-action"
              onClick={skipWatched}
              disabled={saving}
            >
              Not yet
            </button>
            <button
              type="button"
              className="primary-action"
              onClick={markWatched}
              disabled={saving}
            >
              {saving ? "Saving…" : "Mark watched"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
