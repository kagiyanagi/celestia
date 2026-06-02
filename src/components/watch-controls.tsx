"use client";

import { Download, Flag, Mic, Server, Share2 } from "lucide-react";
import { startTransition, useEffect, useState } from "react";
import type { StreamAudioType } from "@/types/streaming";

export type WatchServerOption = {
  id: string;
  label: string;
  href: string;
  active: boolean;
  available: boolean;
};

export type WatchAudioOption = {
  id: StreamAudioType;
  label: string;
  href: string;
  active: boolean;
  available: boolean;
};

type WatchControlsProps = {
  serverOptions: WatchServerOption[];
  audioOptions: WatchAudioOption[];
  activeServerLabel: string;
  title: string;
  episode: number;
};

export function WatchControls({
  serverOptions,
  audioOptions,
  activeServerLabel,
  title,
  episode,
}: WatchControlsProps) {
  const [serverOpen, setServerOpen] = useState(false);
  const [shareLabel, setShareLabel] = useState("Share");

  useEffect(() => {
    if (shareLabel === "Share") {
      return;
    }

    const timer = window.setTimeout(() => setShareLabel("Share"), 1600);

    return () => window.clearTimeout(timer);
  }, [shareLabel]);

  function shareWatchLink() {
    const text = `${title} episode ${episode}`;
    const url = window.location.href;

    if (navigator.share) {
      navigator
        .share({ title: text, text, url })
        .then(() => startTransition(() => setShareLabel("Shared")))
        .catch(() => undefined);
      return;
    }

    navigator.clipboard
      .writeText(url)
      .then(() => startTransition(() => setShareLabel("Copied")))
      .catch(() => startTransition(() => setShareLabel("Copy failed")));
  }

  return (
    <div className="watch-actions" aria-label="Playback actions">
      <div className="watch-audio-switch" aria-label="Audio track">
        {audioOptions.map((option) => (
          <a
            className={
              option.active
                ? "watch-action-button active"
                : "watch-action-button"
            }
            href={option.href}
            key={option.id}
            title={
              option.available
                ? `Switch to ${option.label}`
                : `${option.label} may not be available from this provider`
            }
          >
            <Mic size={17} aria-hidden />
            {option.label}
          </a>
        ))}
      </div>

      <div className="watch-server-menu">
        <button
          className="watch-action-button"
          type="button"
          aria-expanded={serverOpen}
          onClick={() => setServerOpen((value) => !value)}
        >
          <Server size={17} aria-hidden />
          Server
        </button>

        {serverOpen ? (
          <div className="watch-server-popover" role="menu">
            <div className="watch-server-popover-head">
              <strong>Streaming server</strong>
              <span>Current: {activeServerLabel}</span>
            </div>
            {serverOptions.map((server) => (
              <a
                className={
                  server.active
                    ? "watch-server-option active"
                    : "watch-server-option"
                }
                href={server.href}
                key={server.id}
                role="menuitem"
              >
                <span>{server.label}</span>
                <small>{server.available ? "Ready" : "Checking on open"}</small>
              </a>
            ))}
          </div>
        ) : null}
      </div>

      <button
        className="watch-action-button"
        type="button"
        disabled
        title="The current provider exposes iframe embeds, not direct download files."
      >
        <Download size={17} aria-hidden />
        Download
      </button>

      <button className="watch-action-button" type="button" onClick={shareWatchLink}>
        <Share2 size={17} aria-hidden />
        {shareLabel}
      </button>

      <button
        className="watch-action-button"
        type="button"
        disabled
        title="Playback reports can be wired once account or moderation storage exists."
      >
        <Flag size={17} aria-hidden />
        Report
      </button>
    </div>
  );
}
