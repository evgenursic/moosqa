import { unstable_cache } from "next/cache";

import {
  evaluateProductionAlerts,
  getActiveProductionAlerts,
  getAnalyticsOverview,
  getWorkflowRunSummary,
} from "@/lib/analytics";
import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getQualityDashboardData } from "@/lib/quality-dashboard";
import { getSyncStatusSummary } from "@/lib/sync-releases";

const STALE_METADATA_DAYS = 10;

export async function getOpsDashboardData() {
  await ensureDatabase();
  await evaluateProductionAlerts();
  return getCachedOpsDashboardData();
}

const getCachedOpsDashboardData = unstable_cache(
  async () => {
    const staleCutoff = new Date(Date.now() - STALE_METADATA_DAYS * 24 * 60 * 60 * 1000);
    const [sync, quality, analytics, staleMetadata, activeRateLimits, alerts, workflows, recentAlerts, alertDeliveries] = await Promise.all([
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
          message: true,
          createdAt: true,
        },
      }),
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
    };
  },
  ["ops-dashboard"],
  {
    revalidate: 60,
    tags: ["releases", "analytics", "quality-dashboard"],
  },
);

function redactRateLimitKey(value: string) {
  const [scope, ...rest] = value.split(":");
  const target = rest.join(":");
  if (!target) {
    return scope;
  }

  return `${scope}:${target.slice(0, 14)}...`;
}
