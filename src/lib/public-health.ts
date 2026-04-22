import type { getPublicHealthSummary } from "@/lib/ops-dashboard";
import type { SyncStatusSummary } from "@/lib/sync-releases";

type PublicHealthSummary = Awaited<ReturnType<typeof getPublicHealthSummary>>;

export type PublicHealthStatus = "healthy" | "running" | "warning" | "error" | "idle";

export function buildPublicReadinessPayload(generatedAt = new Date()) {
  return {
    ok: true,
    status: "ready",
    generatedAt: generatedAt.toISOString(),
    checks: {
      application: "ready",
    },
  };
}

export function buildPublicHealthPayload(summary: PublicHealthSummary, generatedAt = new Date()) {
  const status = derivePublicHealthStatus(summary.sync, summary.openAlertCount);

  return {
    ok: status === "healthy" || status === "running",
    status,
    generatedAt: generatedAt.toISOString(),
    sync: {
      level: summary.sync.level,
      label: summary.sync.label,
      message: summary.sync.message,
      isRunning: summary.sync.isRunning,
      isStale: summary.sync.isStale,
      lastAttemptAt: summary.sync.lastAttemptAt?.toISOString() || null,
      lastSuccessAt: summary.sync.lastSuccessAt?.toISOString() || null,
      lastDurationMs: summary.sync.lastDurationMs,
      consecutiveFailures: summary.sync.consecutiveFailures,
    },
    alerts: {
      open: summary.openAlertCount,
    },
    lastAlertDelivery: summary.lastAlertDelivery
      ? {
          channel: summary.lastAlertDelivery.channel,
          success: summary.lastAlertDelivery.success,
          attemptedAt: summary.lastAlertDelivery.createdAt.toISOString(),
        }
      : null,
  };
}

function derivePublicHealthStatus(sync: SyncStatusSummary, openAlertCount: number): PublicHealthStatus {
  if (sync.level === "error") {
    return "error";
  }

  if (openAlertCount > 0 && sync.level !== "running") {
    return "warning";
  }

  return sync.level;
}
