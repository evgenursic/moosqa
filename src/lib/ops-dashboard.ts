import { unstable_cache } from "next/cache";

import {
  evaluateProductionAlerts,
  getActiveProductionAlerts,
  getAnalyticsOverview,
  getWorkflowRunSummary,
} from "@/lib/analytics";
import { ensureDatabase } from "@/lib/database";
import { getNotificationOpsSnapshot } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { getQualityDashboardData } from "@/lib/quality-dashboard";
import { getSyncStatusSummary } from "@/lib/sync-releases";

const STALE_METADATA_DAYS = 10;
const ALERT_DELIVERY_STATS_DAYS = 30;

export async function getOpsDashboardData() {
  await ensureDatabase();
  await evaluateProductionAlerts();
  return getCachedOpsDashboardData();
}

export async function getPublicHealthSummary() {
  await ensureDatabase();
  return getCachedPublicHealthSummary();
}

const getCachedOpsDashboardData = unstable_cache(
  async () => {
    const staleCutoff = new Date(Date.now() - STALE_METADATA_DAYS * 24 * 60 * 60 * 1000);
    const alertStatsCutoff = new Date(Date.now() - ALERT_DELIVERY_STATS_DAYS * 24 * 60 * 60 * 1000);
    const [sync, quality, analytics, staleMetadata, activeRateLimits, alerts, workflows, recentAlerts, alertDeliveries, alertChannelBreakdown, notifications] = await Promise.all([
      getSyncStatusSummary(),
      getQualityDashboardData(),
      getAnalyticsOverview(24),
      prisma.release.count({
        where: {
          publishedAt: {
            gte: staleCutoff,
          },
          OR: [
            { releaseDate: null },
            { artworkStatus: { not: "STRONG" } },
            { genreStatus: { not: "STRONG" } },
            { linkStatus: { not: "STRONG" } },
          ],
        },
      }),
      prisma.rateLimitEntry.findMany({
        where: {
          resetAt: {
            gt: new Date(),
          },
        },
        orderBy: [
          { count: "desc" },
          { updatedAt: "desc" },
        ],
        take: 12,
        select: {
          key: true,
          count: true,
          resetAt: true,
          updatedAt: true,
        },
      }),
      getActiveProductionAlerts(),
      getWorkflowRunSummary(),
      prisma.opsAlert.findMany({
        orderBy: [{ lastTriggeredAt: "desc" }],
        take: 14,
        select: {
          key: true,
          severity: true,
          status: true,
          title: true,
          message: true,
          metricValue: true,
          lastTriggeredAt: true,
          lastNotifiedAt: true,
          notificationCount: true,
          resolvedAt: true,
        },
      }),
      prisma.alertDeliveryLog.findMany({
        orderBy: [{ createdAt: "desc" }],
        take: 20,
        select: {
          id: true,
          alertKey: true,
          channel: true,
          destination: true,
          success: true,
          isTest: true,
          responseStatus: true,
          latencyMs: true,
          message: true,
          createdAt: true,
        },
      }),
      prisma.alertDeliveryLog.findMany({
        where: {
          createdAt: {
            gte: alertStatsCutoff,
          },
        },
        orderBy: [{ createdAt: "desc" }],
        select: {
          channel: true,
          success: true,
          isTest: true,
          responseStatus: true,
          latencyMs: true,
          message: true,
          createdAt: true,
        },
      }),
      getNotificationOpsSnapshot(),
    ]);

    return {
      sync,
      quality,
      analytics,
      staleMetadata,
      activeRateLimits: activeRateLimits.map((entry) => ({
        key: redactRateLimitKey(entry.key),
        count: entry.count,
        resetAt: entry.resetAt,
        updatedAt: entry.updatedAt,
      })),
      alerts,
      workflows,
      recentAlerts,
      alertDeliveries,
      alertChannelStats: buildAlertChannelStats(alertChannelBreakdown),
      alertLatencyDaily: buildAlertLatencyDaily(alertChannelBreakdown),
      notifications,
    };
  },
  ["ops-dashboard"],
  {
    revalidate: 300,
    tags: ["releases", "analytics", "quality-dashboard", "ops-dashboard"],
  },
);

const getCachedPublicHealthSummary = unstable_cache(
  async () => {
    const [sync, openAlertCount, lastAlertDelivery] = await Promise.all([
      getSyncStatusSummary(),
      prisma.opsAlert.count({
        where: {
          status: "OPEN",
        },
      }),
      prisma.alertDeliveryLog.findFirst({
        orderBy: [{ createdAt: "desc" }],
        select: {
          channel: true,
          success: true,
          createdAt: true,
          destination: true,
        },
      }),
    ]);

    return {
      sync,
      openAlertCount,
      lastAlertDelivery,
    };
  },
  ["public-health-summary"],
  {
    revalidate: 300,
    tags: ["ops-dashboard", "analytics", "quality-dashboard", "releases"],
  },
);

function buildAlertChannelStats(
  rows: Array<{
    channel: string;
    success: boolean;
    isTest: boolean;
    responseStatus: number | null;
    latencyMs: number | null;
    message: string | null;
    createdAt: Date;
  }>,
) {
  const channelMap = new Map<
    string,
    {
      channel: string;
      total: number;
      success: number;
      failed: number;
      tests: number;
      lastAttemptAt: Date | null;
      lastSuccessAt: Date | null;
      lastFailureAt: Date | null;
      latencyTotalMs: number;
      latencySamples: number;
      failureReasons: Map<string, number>;
    }
  >();

  for (const row of rows) {
    const entry = channelMap.get(row.channel) || {
      channel: row.channel,
      total: 0,
      success: 0,
      failed: 0,
      tests: 0,
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      latencyTotalMs: 0,
      latencySamples: 0,
      failureReasons: new Map<string, number>(),
    };

    entry.total += 1;
    if (row.success) {
      entry.success += 1;
      if (!entry.lastSuccessAt || row.createdAt > entry.lastSuccessAt) {
        entry.lastSuccessAt = row.createdAt;
      }
    } else {
      entry.failed += 1;
      if (!entry.lastFailureAt || row.createdAt > entry.lastFailureAt) {
        entry.lastFailureAt = row.createdAt;
      }
      const failureReason = normalizeAlertFailureReason(row.message, row.responseStatus);
      entry.failureReasons.set(failureReason, (entry.failureReasons.get(failureReason) || 0) + 1);
    }
    if (row.isTest) {
      entry.tests += 1;
    }
    if (typeof row.latencyMs === "number" && row.latencyMs >= 0) {
      entry.latencyTotalMs += row.latencyMs;
      entry.latencySamples += 1;
    }
    if (!entry.lastAttemptAt || row.createdAt > entry.lastAttemptAt) {
      entry.lastAttemptAt = row.createdAt;
    }

    channelMap.set(row.channel, entry);
  }

  return [...channelMap.values()]
    .map((entry) => ({
      ...entry,
      successRate: entry.total > 0 ? Math.round((entry.success / entry.total) * 100) : 0,
      averageLatencyMs:
        entry.latencySamples > 0 ? Math.round(entry.latencyTotalMs / entry.latencySamples) : null,
      topFailureReasons: [...entry.failureReasons.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 3)
        .map(([reason, count]) => ({ reason, count })),
    }))
    .sort((left, right) => right.total - left.total || left.channel.localeCompare(right.channel));
}

function buildAlertLatencyDaily(
  rows: Array<{
    channel: string;
    success: boolean;
    isTest: boolean;
    responseStatus: number | null;
    latencyMs: number | null;
    message: string | null;
    createdAt: Date;
  }>,
) {
  const bucketMap = new Map<
    string,
    {
      dateKey: string;
      label: string;
      counts: Record<string, { totalLatency: number; samples: number }>;
    }
  >();

  for (const row of rows) {
    if (typeof row.latencyMs !== "number" || row.latencyMs < 0) {
      continue;
    }

    const dateKey = row.createdAt.toISOString().slice(0, 10);
    const label = row.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    const bucket = bucketMap.get(dateKey) || {
      dateKey,
      label,
      counts: {},
    };
    const channelEntry = bucket.counts[row.channel] || {
      totalLatency: 0,
      samples: 0,
    };

    channelEntry.totalLatency += row.latencyMs;
    channelEntry.samples += 1;
    bucket.counts[row.channel] = channelEntry;
    bucketMap.set(dateKey, bucket);
  }

  return [...bucketMap.values()]
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey))
    .map((bucket) => ({
      dateKey: bucket.dateKey,
      label: bucket.label,
      latencies: {
        discord: averageLatency(bucket.counts.discord),
        slack: averageLatency(bucket.counts.slack),
        email: averageLatency(bucket.counts.email),
      },
    }));
}

function averageLatency(entry?: { totalLatency: number; samples: number }) {
  if (!entry || entry.samples === 0) {
    return 0;
  }

  return Math.round(entry.totalLatency / entry.samples);
}

function normalizeAlertFailureReason(message: string | null, responseStatus: number | null) {
  if (typeof responseStatus === "number" && responseStatus >= 500) {
    return `HTTP ${responseStatus}`;
  }
  if (typeof responseStatus === "number" && responseStatus >= 400) {
    return `HTTP ${responseStatus}`;
  }
  if (!message) {
    return "Unknown failure";
  }

  const normalized = message.toLowerCase();
  if (normalized.includes("network")) {
    return "Network error";
  }
  if (normalized.includes("not configured")) {
    return "Channel not configured";
  }
  if (normalized.startsWith("http ")) {
    return message.toUpperCase();
  }

  return message.length > 48 ? `${message.slice(0, 45)}...` : message;
}

function redactRateLimitKey(value: string) {
  const [scope, ...rest] = value.split(":");
  const target = rest.join(":");
  if (!target) {
    return scope;
  }

  return `${scope}:${target.slice(0, 14)}...`;
}
