import type { SyncStatusSummary } from "@/lib/sync-releases";
import { formatPubDate, formatRelative } from "@/lib/utils";

type SyncStatusStripProps = {
  status: SyncStatusSummary;
  className?: string;
};

export function SyncStatusStrip({ status, className }: SyncStatusStripProps) {
  const toneClasses =
    status.level === "healthy"
      ? "border-[rgba(35,121,67,0.18)] bg-[rgba(228,244,233,0.92)] text-[rgba(20,86,48,0.95)]"
      : status.level === "running"
        ? "border-[rgba(82,110,170,0.2)] bg-[rgba(228,236,250,0.92)] text-[rgba(50,72,124,0.96)]"
        : status.level === "error"
          ? "border-[rgba(191,72,72,0.18)] bg-[rgba(251,235,235,0.92)] text-[rgba(126,34,34,0.95)]"
          : status.level === "warning"
            ? "border-[rgba(194,138,43,0.2)] bg-[rgba(252,245,228,0.94)] text-[rgba(128,84,19,0.95)]"
            : "border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-muted)]";

  return (
    <section
      className={[
        "border px-4 py-4 md:px-5 md:py-5",
        toneClasses,
        className || "",
      ]
        .join(" ")
        .trim()}
      aria-label="Sync status"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="section-kicker opacity-70">Feed status</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center border border-[rgba(29,34,48,0.12)] bg-white/45 px-3 py-1 text-[11px] uppercase tracking-[0.18em]">
              {status.label}
            </span>
            <p className="text-sm leading-6 opacity-90">{status.message}</p>
          </div>
        </div>

        <div className="grid gap-3 text-[11px] uppercase tracking-[0.18em] opacity-90 sm:grid-cols-2 xl:grid-cols-4">
          <StatusMetric
            label="Last success"
            value={formatStatusDate(status.lastSuccessAt)}
            secondary={status.lastSuccessAt ? formatRelative(status.lastSuccessAt) : null}
          />
          <StatusMetric
            label="Last attempt"
            value={formatStatusDate(status.lastAttemptAt)}
            secondary={status.lastDurationMs !== null ? `${Math.round(status.lastDurationMs / 100) / 10}s` : null}
          />
          <StatusMetric
            label="Sync result"
            value={
              status.lastResult
                ? `${status.lastResult.matched} matched / ${status.lastResult.failed} failed`
                : "No data yet"
            }
            secondary={
              status.lastResult
                ? `${status.lastResult.created} new / ${status.lastResult.updated} refreshed / ${status.lastResult.qualityImproved} quality fixes`
                : null
            }
          />
          <StatusMetric
            label="Failures"
            value={status.consecutiveFailures > 0 ? `${status.consecutiveFailures} in a row` : "0"}
            secondary={status.lastError || null}
          />
        </div>
      </div>
    </section>
  );
}

function StatusMetric({
  label,
  value,
  secondary,
}: {
  label: string;
  value: string;
  secondary?: string | null;
}) {
  return (
    <div className="border border-[rgba(29,34,48,0.08)] bg-white/35 px-3 py-3">
      <p className="opacity-65">{label}</p>
      <p className="mt-2 text-[12px] tracking-[0.08em] normal-case">{value}</p>
      {secondary ? <p className="mt-1 text-[10px] tracking-[0.12em] normal-case opacity-70">{secondary}</p> : null}
    </div>
  );
}

function formatStatusDate(value: Date | null) {
  if (!value) {
    return "Not yet";
  }

  return formatPubDate(value);
}
