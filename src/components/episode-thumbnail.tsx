"use client";

import Image from "next/image";
import { useState } from "react";

type EpisodeThumbnailProps = {
  src: string | null;
  alt: string;
  /** Series cover/banner shown when no episode still exists. */
  fallbackSrc?: string | null;
};

export function EpisodeThumbnail({
  src,
  alt,
  fallbackSrc,
}: EpisodeThumbnailProps) {
  const [failed, setFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const activeSrc = !src || failed ? fallbackSrc : src;

  if (!activeSrc || (activeSrc === fallbackSrc && fallbackFailed)) {
    return (
      <div className="episode-thumbnail-placeholder" aria-hidden>
        <span>{alt.slice(0, 1)}</span>
      </div>
    );
  }

  return (
    <Image
      src={activeSrc}
      alt={alt}
      fill
      sizes="(max-width: 768px) 100vw, 480px"
      onError={() =>
        activeSrc === fallbackSrc ? setFallbackFailed(true) : setFailed(true)
      }
    />
  );
}
