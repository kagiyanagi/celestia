"use client";

import { useState } from "react";

const CLAMP_THRESHOLD = 320;

export function DetailsSynopsis({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = description.length > CLAMP_THRESHOLD;

  return (
    <div className="hero-synopsis-wrap">
      <p className={`hero-synopsis${isLong && !expanded ? " is-clamped" : ""}`}>
        {description}
      </p>
      {isLong ? (
        <button
          type="button"
          className="hero-synopsis-toggle"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      ) : null}
    </div>
  );
}
