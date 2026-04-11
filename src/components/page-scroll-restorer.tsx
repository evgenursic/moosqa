"use client";

import { useEffect } from "react";

import { restoreScrollPositionForCurrentPage } from "@/lib/client-analytics";

export function PageScrollRestorer() {
  useEffect(() => {
    restoreScrollPositionForCurrentPage();
  }, []);

  return null;
}
