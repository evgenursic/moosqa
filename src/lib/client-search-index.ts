"use client";

import type { SearchOverlayPayload } from "@/lib/search-overlay";

let cachedPayload: SearchOverlayPayload | null = null;
let pendingPayloadPromise: Promise<SearchOverlayPayload> | null = null;

export function readCachedSearchIndex() {
  return cachedPayload;
}

export function preloadSearchIndex() {
  if (cachedPayload) {
    return Promise.resolve(cachedPayload);
  }

  if (!pendingPayloadPromise) {
    pendingPayloadPromise = fetch("/api/search/index", {
      cache: "force-cache",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Search index request failed with ${response.status}`);
        }

        return (await response.json()) as SearchOverlayPayload;
      })
      .then((payload) => {
        cachedPayload = payload;
        return payload;
      })
      .finally(() => {
        pendingPayloadPromise = null;
      });
  }

  return pendingPayloadPromise;
}

export const loadSearchIndex = preloadSearchIndex;
