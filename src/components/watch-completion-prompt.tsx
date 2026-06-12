"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { AnimeSummary } from "@/types/anime";
import { useToast } from "@/components/toast-provider";

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
 * back button, switching episodes, going home — a small toast confirmation asks
 * whether to mark it watched. Only on confirmation does it post to /api/history,
 * which bumps the library and syncs AniList. Server/audio swaps stay on the same
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
  const { toast } = useToast();

  // Event handlers run outside React's render, so the values they read live in
  // refs to stay current without re-binding listeners.
  const watchedRef = useRef(0);
  const resolvedRef = useRef(false);
  const promptOpenRef = useRef(false);
  const armedRef = useRef(false);
  const bypassPopRef = useRef(false);
  const pendingRef = useRef<PendingExit | null>(null);
  // Keep stable refs to router and toast so event listeners stay bound once
  const routerRef = useRef(router);
  const toastRef = useRef(toast);
  useEffect(() => { routerRef.current = router; }, [router]);
  useEffect(() => { toastRef.current = toast; }, [toast]);

  useEffect(() => {
    if (!hasSource) {
      return;
    }

    // Per-episode mount: a route navigation to a new episode remounts this.
    watchedRef.current = 0;
    resolvedRef.current = false;
    promptOpenRef.current = false;
    armedRef.current = false;
    bypassPopRef.current = false;
    pendingRef.current = null;

    function eligible(): boolean {
      return (
        !resolvedRef.current &&
        !promptOpenRef.current &&
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

    function continueExit() {
      const pending = pendingRef.current;
      pendingRef.current = null;
      promptOpenRef.current = false;

      if (!pending) return;

      if (pending.kind === "back") {
        bypassPopRef.current = true;
        window.history.back();
        return;
      }
      routerRef.current.push(pending.href);
    }

    function saveWatched() {
      // Fire-and-forget: the viewer asked to leave, so don't block the exit on
      // the network. The save (and AniList mirror) finishes in the background.
      void fetch("/api/history", {
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
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("Save failed");
          toastRef.current({
            type: "success",
            message: `Episode ${episode} marked as watched.`,
          });
        })
        .catch(() => {
          toastRef.current({
            type: "error",
            title: "Couldn't save progress",
            message: "Your watch history may not have been updated.",
          });
        });

      resolvedRef.current = true;
    }

    // Used by the back-button guard, which holds the viewer on the page: save
    // first, then carry them through to where they were headed.
    function markWatchedAndExit() {
      saveWatched();
      continueExit();
    }

    function cancelExit() {
      // The viewer wants to stay — drop the pending exit and re-arm the back
      // guard so a later back press is caught again.
      pendingRef.current = null;
      promptOpenRef.current = false;
      if (!armedRef.current && !resolvedRef.current) {
        armedRef.current = true;
        window.history.pushState(null, "", window.location.href);
      }
    }

    function openPrompt(handlers: { onConfirm: () => void; onCancel?: () => void }) {
      promptOpenRef.current = true;
      const epLabel = episodeTitle ? ` — ${episodeTitle}` : "";
      const minutes = Math.floor(watchedRef.current / 60);
      const timeNote = minutes > 0 ? ` You've spent about ${minutes} min on it.` : "";

      toastRef.current({
        type: "confirmation",
        title: "Mark as watched?",
        message: `Did you finish episode ${episode}${epLabel}?${timeNote} We'll only update your progress if you say so.`,
        confirmLabel: "Mark watched",
        cancelLabel: "Not yet",
        onConfirm: handlers.onConfirm,
        onCancel: handlers.onCancel,
      });
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

      // Respect the click — let the navigation happen now. Swallowing the
      // first click to ask first would hijack the viewer's intent to leave.
      // The ToastProvider lives at the root layout, so this confirmation
      // survives the in-app navigation and can be answered on the next page.
      resolvedRef.current = true;
      openPrompt({ onConfirm: saveWatched });
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
      openPrompt({ onConfirm: markWatchedAndExit, onCancel: cancelExit });
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
  }, [anime, episode, episodeTitle, episodeImage, durationLabel, hasSource]);

  // This component is purely behavioural — it renders nothing of its own.
  return null;
}
