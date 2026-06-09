"use client";

import { Check, Share2 } from "lucide-react";
import { startTransition, useState } from "react";

interface DetailsShareButtonProps {
  title: string;
}

export function DetailsShareButton({ title }: DetailsShareButtonProps) {
  const [shared, setShared] = useState(false);

  function share() {
    const url = window.location.href;

    if (navigator.share) {
      navigator
        .share({ title, text: title, url })
        .then(() => flash())
        .catch(() => undefined);
      return;
    }

    navigator.clipboard
      .writeText(url)
      .then(() => flash())
      .catch(() => undefined);
  }

  function flash() {
    startTransition(() => setShared(true));
    window.setTimeout(() => setShared(false), 2000);
  }

  return (
    <button
      className={`hero-icon-btn ${shared ? "is-active" : ""}`}
      title={shared ? "Link copied" : "Share"}
      type="button"
      onClick={share}
    >
      {shared ? <Check size={20} /> : <Share2 size={20} />}
    </button>
  );
}
