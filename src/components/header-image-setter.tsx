"use client";

import { useEffect } from "react";

type HeaderImageSetterProps = {
  image?: string | null;
};

export function HeaderImageSetter({ image }: HeaderImageSetterProps) {
  useEffect(() => {
    if (!image) {
      document.documentElement.style.removeProperty("--site-header-image");
      return;
    }

    const cssImageUrl = image.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

    document.documentElement.style.setProperty(
      "--site-header-image",
      `url("${cssImageUrl}")`,
    );

    return () => {
      document.documentElement.style.removeProperty("--site-header-image");
    };
  }, [image]);

  return null;
}
