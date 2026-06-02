"use client";

import { startTransition, useEffect, useState } from "react";
import { Check, Minus, Plus } from "lucide-react";

type LocalTrackingState = {
  status: "planning" | "watching" | "completed";
  progress: number;
};

const defaultState: LocalTrackingState = {
  status: "planning",
  progress: 0
};

type LocalTrackerProps = {
  animeId: number;
  totalEpisodes: number | null;
};

export function LocalTracker({ animeId, totalEpisodes }: LocalTrackerProps) {
  const storageKey = `celstia:track:${animeId}`;
  const [state, setState] = useState<LocalTrackingState>(() => {
    if (typeof window === "undefined") {
      return defaultState;
    }

    const stored = window.localStorage.getItem(storageKey);

    if (!stored) {
      return defaultState;
    }

    try {
      return JSON.parse(stored) as LocalTrackingState;
    } catch {
      return defaultState;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, storageKey]);

  function updateState(nextState: LocalTrackingState) {
    startTransition(() => setState(nextState));
  }

  function setStatus(status: LocalTrackingState["status"]) {
    updateState({
      ...state,
      status,
      progress: status === "completed" && totalEpisodes ? totalEpisodes : state.progress
    });
  }

  function setProgress(direction: 1 | -1) {
    const nextProgress = Math.max(
      0,
      Math.min(totalEpisodes || Number.POSITIVE_INFINITY, state.progress + direction)
    );

    updateState({
      status: nextProgress > 0 ? "watching" : state.status,
      progress: nextProgress
    });
  }

  return (
    <section className="tracker-panel" aria-label="Local tracking panel">
      <span className="section-kicker">
        <Check size={16} aria-hidden />
        watch progress
      </span>
      <h2>Your progress</h2>
      <p>
        Save where you are on this device. Account sync comes next.
      </p>

      <div className="tracker-status-grid">
        {(["planning", "watching", "completed"] as const).map((status) => (
          <button
            className={state.status === status ? "tracker-status active" : "tracker-status"}
            key={status}
            onClick={() => setStatus(status)}
            type="button"
          >
            {status}
          </button>
        ))}
      </div>

      <div className="progress-stepper">
        <button type="button" onClick={() => setProgress(-1)} aria-label="Decrease episode progress">
          <Minus size={16} aria-hidden />
        </button>
        <strong>
          {state.progress}
          {totalEpisodes ? ` / ${totalEpisodes}` : ""} watched
        </strong>
        <button type="button" onClick={() => setProgress(1)} aria-label="Increase episode progress">
          <Plus size={16} aria-hidden />
        </button>
      </div>
    </section>
  );
}
