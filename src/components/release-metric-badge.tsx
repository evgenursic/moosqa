import { buildBestReleaseMetricSignal, type ReleaseMetricInput } from "@/lib/release-metrics";
import { cn } from "@/lib/utils";

type ReleaseMetricBadgeProps = ReleaseMetricInput & {
  className?: string;
  compact?: boolean;
  tone?: "paper" | "dark";
};

export function ReleaseMetricBadge({
  className,
  compact = false,
  tone = "paper",
  ...metricInput
}: ReleaseMetricBadgeProps) {
  const signal = buildBestReleaseMetricSignal(metricInput);

  if (!signal) {
    return null;
  }

  return (
    <span
      aria-label={signal.ariaLabel}
      className={cn(
        "inline-flex max-w-full items-center border uppercase tracking-[0.16em]",
        compact ? "px-2 py-1 text-[9px]" : "px-3 py-2 text-[10px]",
        tone === "dark"
          ? "border-white/15 bg-white/[0.04] text-white/68"
          : "border-[var(--color-line)] bg-[var(--color-panel)] text-black/58",
        className,
      )}
    >
      <span className="truncate">{signal.label}</span>
    </span>
  );
}
