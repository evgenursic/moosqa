const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

const WORKFLOW_STALENESS_THRESHOLDS: Record<string, { thresholdMs: number; cadenceLabel: string }> = {
  sync: {
    thresholdMs: 30 * MINUTE_MS,
    cadenceLabel: "5 min",
  },
  quality: {
    thresholdMs: 3 * HOUR_MS,
    cadenceLabel: "hourly",
  },
  repair: {
    thresholdMs: 3 * HOUR_MS,
    cadenceLabel: "hourly",
  },
};

const DETAIL_LABELS: Record<string, string> = {
  scanned: "scanned",
  matched: "matched",
  created: "created",
  updated: "updated",
  removed: "removed",
  sanitized: "sanitized",
  enriched: "enriched",
  qualityChecked: "checked",
  qualityImproved: "improved",
  mode: "mode",
  queued: "queued",
  checked: "checked",
  improved: "improved",
  syncedAt: "synced",
  evaluated: "evaluated",
  existing: "existing",
  processed: "processed",
  sent: "sent",
  failed: "failed",
  skipped: "skipped",
  phase: "phase",
  baseUrl: "target",
  tests: "tests",
  trigger: "trigger",
};

export type WorkflowDetailMetric = {
  key: string;
  label: string;
  value: string;
};

export type WorkflowStaleness = {
  isStale: boolean;
  ageMs: number | null;
  thresholdMs: number;
  cadenceLabel: string;
};

export function parseWorkflowDetails(details: string | null | undefined): WorkflowDetailMetric[] {
  if (!details) {
    return [];
  }

  return details
    .split(",")
    .map((entry) => entry.trim())
    .map((entry) => {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex <= 0) {
        return null;
      }

      const key = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();
      if (!/^[A-Za-z][A-Za-z0-9_-]{0,48}$/.test(key) || !value) {
        return null;
      }

      return {
        key,
        label: DETAIL_LABELS[key] || key,
        value: value.slice(0, 120),
      };
    })
    .filter((entry): entry is WorkflowDetailMetric => Boolean(entry));
}

export function getWorkflowStaleness(
  workflowName: string,
  lastRunAt: Date | null | undefined,
  now = new Date(),
): WorkflowStaleness | null {
  const config = WORKFLOW_STALENESS_THRESHOLDS[workflowName];
  if (!config) {
    return null;
  }

  if (!lastRunAt) {
    return {
      isStale: true,
      ageMs: null,
      thresholdMs: config.thresholdMs,
      cadenceLabel: config.cadenceLabel,
    };
  }

  const ageMs = Math.max(0, now.getTime() - lastRunAt.getTime());
  return {
    isStale: ageMs > config.thresholdMs,
    ageMs,
    thresholdMs: config.thresholdMs,
    cadenceLabel: config.cadenceLabel,
  };
}

export function formatWorkflowAgeMinutes(ageMs: number | null) {
  if (ageMs === null) {
    return "unknown";
  }

  return `${Math.max(1, Math.round(ageMs / MINUTE_MS))} min`;
}
