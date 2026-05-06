"use client";

import { useEffect, useSyncExternalStore } from "react";
import { cn, formatCompactWholeCount } from "@/lib/utils";

type ReleaseRedditStatsProps = {
  upvotes?: number | string | null;
  comments?: number | string | null;
  redditId?: string | null;
  slug?: string | null;
  className?: string;
  compact?: boolean;
  tone?: "paper" | "dark";
};

export function ReleaseRedditStats({
  upvotes,
  comments,
  redditId,
  slug,
  className,
  compact = false,
  tone = "paper",
}: ReleaseRedditStatsProps) {
  const liveStats = useLiveRedditStats(redditId, slug);
  const upvoteValue = liveStats?.upvotes ?? coerceStat(upvotes);
  const commentValue = liveStats?.comments ?? coerceStat(comments);
  const upvoteLabel = formatRedditStat(upvoteValue);
  const commentLabel = formatRedditStat(commentValue);
  const stats = [
    { label: "Upvotes", value: upvoteLabel, aria: buildAriaLabel(upvoteLabel, "upvotes") },
    { label: "Comments", value: commentLabel, aria: buildAriaLabel(commentLabel, "comments") },
  ];

  return (
    <div
      aria-label={stats.map((stat) => stat.aria).join(", ")}
      className={cn(
        "grid w-fit max-w-full grid-cols-2 gap-1.5",
        stats.length === 1 ? "grid-cols-1" : null,
        className,
      )}
    >
      {stats.map((stat) => (
        <span
          key={stat.label}
          className={cn(
            "inline-flex min-w-0 flex-col border font-semibold uppercase shadow-[0_10px_24px_rgba(29,34,48,0.08)]",
            compact ? "px-2.5 py-1.5" : "px-3 py-2",
            tone === "dark"
              ? "border-white/14 bg-white/[0.055] text-white"
              : "border-[var(--color-soft-line)] bg-[var(--color-panel)] text-[var(--color-ink)]",
          )}
        >
          <span className={cn("leading-none", compact ? "text-sm" : "text-base")}>{stat.value}</span>
          <span
            className={cn(
              "mt-1 truncate tracking-[0.16em]",
              compact ? "text-[8px]" : "text-[9px]",
              tone === "dark" ? "text-white/52" : "text-black/48",
            )}
          >
            {stat.label}
          </span>
        </span>
      ))}
    </div>
  );
}

type LiveRedditStats = {
  upvotes: number | null;
  comments: number | null;
};

const liveStatsCache = new Map<string, LiveRedditStats>();
const liveStatsListeners = new Map<string, Set<() => void>>();
const pendingLiveStatIds = new Set<string>();
let liveStatsFlushScheduled = false;

function useLiveRedditStats(
  redditId: string | null | undefined,
  slug: string | null | undefined,
) {
  const safeId = sanitizeRedditId(redditId) ?? extractRedditIdFromSlug(slug);
  const stats = useSyncExternalStore(
    (onStoreChange) => subscribeLiveStats(safeId, onStoreChange),
    () => (safeId ? liveStatsCache.get(safeId) ?? null : null),
    () => null,
  );

  useEffect(() => {
    if (safeId && !liveStatsCache.has(safeId)) {
      pendingLiveStatIds.add(safeId);
      scheduleLiveStatsFlush();
    }
  }, [safeId]);

  return stats;
}

function subscribeLiveStats(id: string | null, onStoreChange: () => void) {
  if (!id) {
    return () => undefined;
  }

  let listeners = liveStatsListeners.get(id);
  if (!listeners) {
    listeners = new Set();
    liveStatsListeners.set(id, listeners);
  }

  listeners.add(onStoreChange);

  return () => {
    listeners?.delete(onStoreChange);
    if (listeners?.size === 0) {
      liveStatsListeners.delete(id);
    }
  };
}

function sanitizeRedditId(value: string | null | undefined) {
  const id = value?.trim();
  return id && /^[a-z0-9]+$/i.test(id) ? id : null;
}

function extractRedditIdFromSlug(slug: string | null | undefined) {
  const id = slug?.match(/-([a-z0-9]{5,12})$/i)?.[1] ?? null;
  return sanitizeRedditId(id);
}

function scheduleLiveStatsFlush() {
  if (liveStatsFlushScheduled) {
    return;
  }

  liveStatsFlushScheduled = true;
  window.setTimeout(() => {
    liveStatsFlushScheduled = false;
    void flushLiveStats();
  }, 40);
}

async function flushLiveStats() {
  const ids = [...pendingLiveStatIds].slice(0, 100);
  ids.forEach((id) => pendingLiveStatIds.delete(id));
  const missingIds = ids.filter((id) => !liveStatsCache.has(id));
  if (missingIds.length === 0) {
    return;
  }

  try {
    const response = await fetch(
      `/api/reddit-stats?ids=${missingIds.join(",")}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as RedditInfoPayload;
    for (const metric of payload.metrics ?? []) {
      const id = metric.id;
      if (!id) {
        continue;
      }

      notifyLiveStats(id, {
        upvotes: coerceStat(metric.upvotes),
        comments: coerceStat(metric.comments),
      });
    }
  } catch {
    // Keep the server-rendered DB value or "/" fallback if Reddit blocks the browser request.
  }
}

type RedditInfoPayload = {
  metrics?: Array<{
    id?: string;
    upvotes?: number | string | null;
    comments?: number | string | null;
  }>;
};

function notifyLiveStats(id: string, stats: LiveRedditStats) {
  liveStatsCache.set(id, stats);
  const listeners = liveStatsListeners.get(id);
  if (!listeners) {
    return;
  }

  listeners.forEach((listener) => listener());
}

function buildAriaLabel(value: string, label: "upvotes" | "comments") {
  if (value === "/") {
    return `Reddit ${label} unavailable`;
  }

  return `${value} Reddit ${label}`;
}

function formatRedditStat(value: number | null) {
  if (value === null) {
    return "/";
  }

  return formatCompactWholeCount(value) ?? "0";
}

function coerceStat(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  return null;
}
