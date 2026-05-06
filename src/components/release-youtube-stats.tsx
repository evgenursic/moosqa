"use client";

import { useLiveYouTubeStats } from "@/lib/client-youtube-stats";
import { type ReleaseMetricInput } from "@/lib/release-metrics";
import { cn, formatCompactWholeCount } from "@/lib/utils";

type ReleaseYouTubeStatsProps = ReleaseMetricInput & {
  releaseId?: string | null;
  youtubePublishedAt?: Date | string | null;
  className?: string;
  compact?: boolean;
  tone?: "paper" | "dark";
};

export function ReleaseYouTubeStats({
  releaseId,
  youtubePublishedAt,
  className,
  compact = false,
  tone = "paper",
  ...metricInput
}: ReleaseYouTubeStatsProps) {
  const liveStats = useLiveYouTubeStats(releaseId, metricInput);
  const viewsLabel = formatYouTubeViews(liveStats?.youtubeViewCount ?? metricInput.youtubeViewCount);
  const publishedLabel = formatYouTubePublished(liveStats?.youtubePublishedAt ?? youtubePublishedAt);

  if (!viewsLabel && !publishedLabel) {
    return null;
  }

  const stats = [
    { label: "YouTube views", value: viewsLabel ?? "/", aria: viewsLabel ? `${viewsLabel} YouTube views` : "YouTube views unavailable" },
    { label: "Published", value: publishedLabel ?? "/", aria: publishedLabel ? `Published on YouTube ${publishedLabel}` : "YouTube publish date unavailable" },
  ];

  return (
    <div
      aria-label={stats.map((stat) => stat.aria).join(", ")}
      className={cn(
        "grid w-fit max-w-full grid-cols-2 gap-1.5",
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

function formatYouTubeViews(value: number | string | null | undefined) {
  const views = coerceMetricNumber(value);
  const formatted = formatCompactWholeCount(views);
  return formatted ? `${formatted}` : null;
}

function formatYouTubePublished(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function coerceMetricNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}
