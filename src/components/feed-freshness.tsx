import type { SyncStatusSummary } from "@/lib/sync-releases";
import { cn, formatRelative } from "@/lib/utils";

type FeedFreshnessProps = {
  summary: SyncStatusSummary;
  className?: string;
};

export function FeedFreshness({ summary, className }: FeedFreshnessProps) {
  const primaryLabel = getPrimaryLabel(summary);
  const secondaryLabel = getSecondaryLabel(summary);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[var(--color-line)] pt-4 text-[10px] uppercase tracking-[0.18em] text-black/46",
        className,
      )}
    >
      <span>{primaryLabel}</span>
      {secondaryLabel ? <span className="text-black/34">{secondaryLabel}</span> : null}
    </div>
  );
}

function getPrimaryLabel(summary: SyncStatusSummary) {
  if (summary.lastSuccessAt) {
    return `Last updated ${formatRelative(summary.lastSuccessAt)}`;
  }

  if (summary.isRunning) {
    return "Refreshing feed";
  }

  return "Preparing first sync";
}

function getSecondaryLabel(summary: SyncStatusSummary) {
  if (summary.isRunning) {
    return "Refreshing now";
  }

  if (summary.consecutiveFailures > 0 || summary.isStale) {
    return "Catching up";
  }

  return null;
}
