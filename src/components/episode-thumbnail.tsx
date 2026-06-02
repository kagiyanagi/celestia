"use client";

import Image from "next/image";
import { useState } from "react";

type EpisodeThumbnailProps = {
  src: string | null;
  alt: string;
};

export function EpisodeThumbnail({ src, alt }: EpisodeThumbnailProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="episode-thumbnail-placeholder" aria-hidden>
        <span>{alt.slice(0, 1)}</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="240px"
      onError={() => setFailed(true)}
    />
  );
}
