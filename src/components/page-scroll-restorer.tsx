"use client";

import { useLayoutEffect } from "react";

import { restoreScrollPositionForCurrentPage } from "@/lib/client-analytics";

export function PageScrollRestorer() {
  useLayoutEffect(() => {
    restoreScrollPositionForCurrentPage();
  }, []);

  return null;
}
