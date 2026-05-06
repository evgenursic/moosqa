"use client";

import { useEffect, useSyncExternalStore } from "react";
import { isYouTubeFirstMetricInput, type ReleaseMetricInput } from "@/lib/release-metrics";

export type LiveYouTubeStats = {
  youtubeViewCount: number | null;
  youtubePublishedAt: string | null;
};

const liveYouTubeStatsCache = new Map<string, LiveYouTubeStats>();
const liveYouTubeStatsListeners = new Map<string, Set<() => void>>();
const pendingYouTubeReleaseIds = new Set<string>();
let liveYouTubeStatsFlushScheduled = false;

export function useLiveYouTubeStats(
  releaseId: string | null | undefined,
  metricInput: ReleaseMetricInput,
) {
  const safeReleaseId = sanitizeReleaseId(releaseId);
  const shouldTrack = Boolean(safeReleaseId && isYouTubeFirstMetricInput(metricInput));
  const stats = useSyncExternalStore(
    (onStoreChange) => subscribeLiveYouTubeStats(shouldTrack ? safeReleaseId : null, onStoreChange),
    () => (shouldTrack && safeReleaseId ? liveYouTubeStatsCache.get(safeReleaseId) ?? null : null),
    () => null,
  );

  useEffect(() => {
    if (!shouldTrack || !safeReleaseId || liveYouTubeStatsCache.has(safeReleaseId)) {
      return;
    }

    pendingYouTubeReleaseIds.add(safeReleaseId);
    scheduleLiveYouTubeStatsFlush();
  }, [safeReleaseId, shouldTrack]);

  return stats;
}

function subscribeLiveYouTubeStats(id: string | null, onStoreChange: () => void) {
  if (!id) {
    return () => undefined;
  }

  let listeners = liveYouTubeStatsListeners.get(id);
  if (!listeners) {
    listeners = new Set();
    liveYouTubeStatsListeners.set(id, listeners);
  }

  listeners.add(onStoreChange);

  return () => {
    listeners?.delete(onStoreChange);
    if (listeners?.size === 0) {
      liveYouTubeStatsListeners.delete(id);
    }
  };
}

function scheduleLiveYouTubeStatsFlush() {
  if (liveYouTubeStatsFlushScheduled) {
    return;
  }

  liveYouTubeStatsFlushScheduled = true;
  window.setTimeout(() => {
    liveYouTubeStatsFlushScheduled = false;
    void flushLiveYouTubeStats();
  }, 80);
}

async function flushLiveYouTubeStats() {
  const releaseIds = [...pendingYouTubeReleaseIds].slice(0, 36);
  releaseIds.forEach((id) => pendingYouTubeReleaseIds.delete(id));
  const missingIds = releaseIds.filter((id) => !liveYouTubeStatsCache.has(id));
  if (missingIds.length === 0) {
    return;
  }

  try {
    const response = await fetch("/api/youtube-stats", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ releaseIds: missingIds }),
      cache: "no-store",
    });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as YouTubeStatsPayload;
    for (const metric of payload.metrics ?? []) {
      const releaseId = sanitizeReleaseId(metric.releaseId);
      if (!releaseId) {
        continue;
      }

      notifyLiveYouTubeStats(releaseId, {
        youtubeViewCount: coerceMetricNumber(metric.youtubeViewCount),
        youtubePublishedAt: typeof metric.youtubePublishedAt === "string" ? metric.youtubePublishedAt : null,
      });
    }
  } catch {
    // Keep the server-rendered DB value or the normal badge fallback.
  }
}

type YouTubeStatsPayload = {
  metrics?: Array<{
    releaseId?: string;
    youtubeViewCount?: number | string | null;
    youtubePublishedAt?: string | null;
  }>;
};

function notifyLiveYouTubeStats(id: string, stats: LiveYouTubeStats) {
  liveYouTubeStatsCache.set(id, stats);
  const listeners = liveYouTubeStatsListeners.get(id);
  if (!listeners) {
    return;
  }

  listeners.forEach((listener) => listener());
}

function sanitizeReleaseId(value: string | null | undefined) {
  const id = value?.trim();
  return id && /^[a-z0-9]{8,40}$/i.test(id) ? id : null;
}

function coerceMetricNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  return null;
}
