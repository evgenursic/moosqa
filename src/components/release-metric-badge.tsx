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
