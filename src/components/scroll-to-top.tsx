"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Forces the viewport to the top whenever the path changes.
 *
 * Next's App Router runs a single "scroll the changed segment into view" pass
 * during the loading→content streaming transition. When you open a link that
 * sat low in the previous page, the new segment can measure as already partly
 * in view, so that pass is skipped and the page opens mid-scroll. This is a
 * backstop: in the normal case the page is already at the top, so scrollTo is a
 * no-op; it only corrects the intermittent failure.
 */
export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
