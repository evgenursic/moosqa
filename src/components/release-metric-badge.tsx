"use client";

import { useLiveYouTubeStats } from "@/lib/client-youtube-stats";
import { buildBestReleaseMetricSignal, type ReleaseMetricInput } from "@/lib/release-metrics";
import { cn } from "@/lib/utils";

type ReleaseMetricBadgeProps = ReleaseMetricInput & {
  releaseId?: string | null;
  className?: string;
  compact?: boolean;
  tone?: "paper" | "dark";
};

export function ReleaseMetricBadge({
  releaseId,
  className,
  compact = false,
  tone = "paper",
  ...metricInput
}: ReleaseMetricBadgeProps) {
  const liveYouTubeStats = useLiveYouTubeStats(releaseId, metricInput);
  const signal = buildBestReleaseMetricSignal({
    ...metricInput,
    youtubeViewCount: liveYouTubeStats?.youtubeViewCount ?? metricInput.youtubeViewCount,
  });

  if (!signal) {
    return null;
  }

  return (
    <span
      aria-label={signal.ariaLabel}
      data-release-metric-kind={signal.kind}
      className={cn(
        "inline-flex max-w-full items-center border font-medium uppercase tracking-[0.16em] shadow-[0_10px_28px_rgba(29,34,48,0.12)]",
        compact ? "px-2 py-1 text-[9px]" : "px-3 py-2 text-[10px]",
        tone === "dark"
          ? "border-white/15 bg-white/[0.04] text-white/68"
          : "border-[var(--color-line)] bg-[var(--color-paper)]/95 text-[var(--color-ink)]",
        className,
      )}
    >
      <span className="truncate">{signal.label}</span>
    </span>
  );
}
