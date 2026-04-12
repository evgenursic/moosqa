import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";

import {
  AnalyticsEventType,
  ReleaseReactionValue,
  WorkflowRunStatus,
} from "@/generated/prisma/enums";
import { type Prisma } from "@/generated/prisma/client";
import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getQualityDashboardData } from "@/lib/quality-dashboard";
import { getSectionReleasesForInsights } from "@/lib/release-sections";
import { getSyncStatusSummary } from "@/lib/sync-releases";

export type AnalyticsAction =
  | "OPEN"
  | "LISTEN_CLICK"
  | "VOTE"
  | "SHARE"
  | "REACTION_POSITIVE"
  | "REACTION_NEGATIVE";

type AnalyticsPayload = {
  releaseId?: string | null;
  action: AnalyticsAction;
  platform?: string | null;
  href?: string | null;
  sourcePath?: string | null;
  metadata?: Record<string, unknown> | null;
  request?: Request | null;
  deviceKey?: string | null;
};

type WorkflowStatusPayload = {
  workflowName: string;
  status: "SUCCESS" | "FAILURE" | "RUNNING" | "CANCELLED";
  runUrl?: string | null;
  branch?: string | null;
  commitSha?: string | null;
  details?: string | null;
  completedAt?: Date | null;
};

type ProductionAlert = {
  key: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  message: string;
  metricValue?: number | null;
  context?: Record<string, unknown> | null;
};

type AnalyticsInsightItem = {
  releaseId: string;
  count: number;
  release: Awaited<ReturnType<typeof getSectionReleasesForInsights>>[number] | null;
};

const ANALYTICS_LOOKBACK_HOURS = 24;
const REPAIR_QUEUE_ALERT_THRESHOLD = 28;
const STALE_METADATA_ALERT_THRESHOLD = 34;
const ANALYTICS_TAG = "analytics";
const ALERT_NOTIFICATION_COOLDOWN_MS = 1000 * 60 * 30;
const PUBLIC_PLATFORM_LABELS = ["Bandcamp", "YouTube", "YouTube Music"] as const;

const ANALYTICS_DEBOUNCE_WINDOWS: Record<AnalyticsAction, number> = {
  OPEN: 1000 * 60 * 30,
  LISTEN_CLICK: 1000 * 60 * 4,
  VOTE: 0,
  SHARE: 1000 * 60 * 10,
  REACTION_POSITIVE: 1000 * 60 * 90,
  REACTION_NEGATIVE: 1000 * 60 * 90,
};

export async function recordAnalyticsEvent(payload: AnalyticsPayload) {
  await ensureDatabase();

  const deviceHash = buildDeviceHash(payload.request, payload.deviceKey);
  const sanitizedSourcePath = sanitizeSourcePath(payload.sourcePath);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    if (payload.releaseId && shouldDebounceAnalyticsAction(payload.action)) {
      const debounced = await checkAnalyticsDebounce(tx, {
        releaseId: payload.releaseId,
        action: payload.action,
        deviceHash,
        platform: payload.platform || null,
        href: payload.href || null,
        now,
      });

      if (debounced) {
        return {
          ok: true as const,
          recorded: false,
          debounced: true,
          releaseCounters: await getReleaseReactionSnapshot(tx, payload.releaseId),
        };
      }
    }

    if (payload.releaseId && isReactionAction(payload.action)) {
      const reactionResult = await persistReleaseReaction(tx, {
        releaseId: payload.releaseId,
        deviceHash,
        action: payload.action,
      });

      if (!reactionResult.changed) {
        return {
          ok: true as const,
          recorded: false,
          debounced: false,
          releaseCounters: reactionResult.counters,
        };
      }
    }

    await tx.analyticsEvent.create({
      data: {
        releaseId: payload.releaseId || null,
        action: AnalyticsEventType[payload.action],
        platform: payload.platform || null,
        href: payload.href || null,
        sourcePath: sanitizedSourcePath,
        deviceHash,
        metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
      },
    });

    let releaseCounters = null;
    if (payload.releaseId) {
      releaseCounters = await incrementReleaseAnalyticsCounter(tx, payload.releaseId, payload.action, now);
    }

    return {
      ok: true as const,
      recorded: true,
      debounced: false,
      releaseCounters,
    };
  });

  revalidateTag(ANALYTICS_TAG, "max");
  revalidateTag("ops-dashboard", "max");
  return result;
}

export async function getAnalyticsOverview(hours = ANALYTICS_LOOKBACK_HOURS) {
  await ensureDatabase();
  return getCachedAnalyticsOverview(Math.max(1, Math.floor(hours)));
}

export async function getPublicAnalyticsInsights() {
  await ensureDatabase();
  return getCachedPublicAnalyticsInsights();
}

export async function updateWorkflowRunState(payload: WorkflowStatusPayload) {
  await ensureDatabase();

  const completedAt = payload.completedAt || new Date();

  await prisma.workflowRunState.upsert({
    where: {
      workflowName: payload.workflowName,
    },
    update: {
      status: WorkflowRunStatus[payload.status],
      runUrl: payload.runUrl || null,
      branch: payload.branch || null,
      commitSha: payload.commitSha || null,
      details: payload.details || null,
      lastRunAt: completedAt,
      lastSuccessAt: payload.status === "SUCCESS" ? completedAt : undefined,
      lastFailureAt: payload.status === "FAILURE" ? completedAt : undefined,
    },
    create: {
      workflowName: payload.workflowName,
      status: WorkflowRunStatus[payload.status],
      runUrl: payload.runUrl || null,
      branch: payload.branch || null,
      commitSha: payload.commitSha || null,
      details: payload.details || null,
      lastRunAt: completedAt,
      lastSuccessAt: payload.status === "SUCCESS" ? completedAt : null,
      lastFailureAt: payload.status === "FAILURE" ? completedAt : null,
    },
  });

  await evaluateProductionAlerts();
  revalidateTag("quality-dashboard", "max");
  revalidateTag("ops-dashboard", "max");
}

export async function getWorkflowRunSummary() {
  await ensureDatabase();

  return prisma.workflowRunState.findMany({
    orderBy: [{ workflowName: "asc" }],
  });
}

export async function evaluateProductionAlerts() {
  await ensureDatabase();

  const [sync, quality, workflowStates] = await Promise.all([
    getSyncStatusSummary(),
    getQualityDashboardData(),
    prisma.workflowRunState.findMany(),
  ]);

  const alerts: ProductionAlert[] = [];

  if (sync.consecutiveFailures >= 3) {
    alerts.push({
      key: "sync-consecutive-failures",
      severity: "CRITICAL",
      title: "Sync stalled",
      message: `${sync.consecutiveFailures} sync runs failed in a row. Feed freshness is at risk.`,
      metricValue: sync.consecutiveFailures,
      context: {
        lastFailureAt: sync.lastFailureAt?.toISOString() || null,
        lastError: sync.lastError || null,
      },
    });
  }

  if (quality.totals.retryQueue >= REPAIR_QUEUE_ALERT_THRESHOLD) {
    alerts.push({
      key: "repair-queue-pressure",
      severity: "WARNING",
      title: "Repair queue pressure",
      message: `Weak-card repair queue reached ${quality.totals.retryQueue} items.`,
      metricValue: quality.totals.retryQueue,
    });
  }

  if (quality.totals.missingReleaseDate >= STALE_METADATA_ALERT_THRESHOLD) {
    alerts.push({
      key: "stale-metadata-pressure",
      severity: "WARNING",
      title: "Metadata drift",
      message: `${quality.totals.missingReleaseDate} recent cards are still missing a verified release date.`,
      metricValue: quality.totals.missingReleaseDate,
    });
  }

  for (const workflow of workflowStates) {
    if (workflow.status !== WorkflowRunStatus.FAILURE) {
      continue;
    }

    alerts.push({
      key: `workflow-${workflow.workflowName}`,
      severity: "WARNING",
      title: `${workflow.workflowName} workflow failed`,
      message: `${workflow.workflowName} reported a failed GitHub run.`,
      context: {
        runUrl: workflow.runUrl,
        lastFailureAt: workflow.lastFailureAt?.toISOString() || null,
      },
    });
  }

  await persistProductionAlerts(alerts);
  await deliverPendingAlertNotifications();
  return getActiveProductionAlerts();
}

export async function getActiveProductionAlerts() {
  await ensureDatabase();

  return prisma.opsAlert.findMany({
    where: {
      status: "OPEN",
    },
    orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
  });
}

const getCachedAnalyticsOverview = unstable_cache(
  async (hours: number) => {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const [counts, topReleases, platformCounts, aggregatedTopReleases] = await Promise.all([
      prisma.analyticsEvent.groupBy({
        by: ["action"],
        where: {
          createdAt: {
            gte: since,
          },
        },
        _count: {
          _all: true,
        },
      }),
      prisma.analyticsEvent.groupBy({
        by: ["releaseId"],
        where: {
          createdAt: {
            gte: since,
          },
          releaseId: {
            not: null,
          },
        },
        _count: {
          _all: true,
        },
        orderBy: {
          _count: {
            releaseId: "desc",
          },
        },
        take: 8,
      }),
      prisma.analyticsEvent.groupBy({
        by: ["platform"],
        where: {
          createdAt: {
            gte: since,
          },
          platform: {
            not: null,
          },
        },
        _count: {
          _all: true,
        },
      }),
      prisma.release.findMany({
        where: {
          OR: [
            { openCount: { gt: 0 } },
            { listenClickCount: { gt: 0 } },
            { shareCount: { gt: 0 } },
            { positiveReactionCount: { gt: 0 } },
            { negativeReactionCount: { gt: 0 } },
          ],
        },
        orderBy: [
          { openCount: "desc" },
          { listenClickCount: "desc" },
          { shareCount: "desc" },
          { analyticsUpdatedAt: "desc" },
        ],
        take: 10,
        select: {
          id: true,
          slug: true,
          title: true,
          artistName: true,
          projectTitle: true,
          openCount: true,
          listenClickCount: true,
          shareCount: true,
          positiveReactionCount: true,
          negativeReactionCount: true,
          analyticsUpdatedAt: true,
        },
      }),
    ]);

    const releaseIds = topReleases
      .map((entry) => entry.releaseId)
      .filter((value): value is string => Boolean(value));
    const releaseMap = new Map(
      (
        await prisma.release.findMany({
          where: {
            id: {
              in: releaseIds,
            },
          },
          select: {
            id: true,
            slug: true,
            title: true,
            artistName: true,
            projectTitle: true,
          },
        })
      ).map((release) => [release.id, release]),
    );

    return {
      hours,
      since,
      counts: counts.map((entry) => ({
        action: entry.action,
        count: entry._count?._all ?? 0,
      })),
      platforms: platformCounts
        .map((entry) => ({
          platform: entry.platform || "unknown",
          count: entry._count?._all ?? 0,
        }))
        .sort((left, right) => right.count - left.count),
      topReleases: topReleases.map((entry) => ({
        releaseId: entry.releaseId,
        count: entry._count._all,
        release: entry.releaseId ? releaseMap.get(entry.releaseId) || null : null,
      })),
      aggregateTopReleases: aggregatedTopReleases,
    };
  },
  ["analytics-overview"],
  {
    revalidate: 60,
    tags: [ANALYTICS_TAG],
  },
);

const getCachedPublicAnalyticsInsights = unstable_cache(
  async () => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [openedToday, sharedThisWeek, listenedThisWeek, platformHighlights, latestReleases] = await Promise.all([
      getTopAnalyticsInsightByAction("OPEN", todayStart, 1),
      getTopAnalyticsInsightByAction("SHARE", weekStart, 1),
      getTopAnalyticsInsightByAction("LISTEN_CLICK", weekStart, 1),
      Promise.all(
        PUBLIC_PLATFORM_LABELS.map(async (platform) => ({
          platform,
          entry: (await getTopAnalyticsInsightByAction("LISTEN_CLICK", weekStart, 1, platform))[0] || null,
        })),
      ),
      getSectionReleasesForInsights("latest"),
    ]);

    return {
      mostOpenedToday: openedToday[0] || null,
      mostSharedThisWeek: sharedThisWeek[0] || null,
      mostClickedToListen: listenedThisWeek[0] || null,
      platformHighlights,
      fallbackLatest: latestReleases.slice(0, 3),
    };
  },
  ["public-analytics-insights"],
  {
    revalidate: 300,
    tags: [ANALYTICS_TAG, "releases"],
  },
);

async function getTopAnalyticsInsightByAction(
  action: AnalyticsAction,
  since: Date,
  take = 3,
  platform?: string,
): Promise<AnalyticsInsightItem[]> {
  const groups = await prisma.analyticsEvent.groupBy({
    by: ["releaseId"],
    where: {
      action: AnalyticsEventType[action],
      createdAt: {
        gte: since,
      },
      releaseId: {
        not: null,
      },
      ...(platform ? { platform } : {}),
    },
    _count: {
      _all: true,
    },
    orderBy: {
      _count: {
        releaseId: "desc",
      },
    },
    take,
  });

  const releaseIds = groups
    .map((entry) => entry.releaseId)
    .filter((entry): entry is string => Boolean(entry));
  if (releaseIds.length === 0) {
    return [];
  }

  const latestReleases = await getSectionReleasesForInsights("latest");
  const releaseMap = new Map(
    latestReleases
      .filter((release) => releaseIds.includes(release.id))
      .map((release) => [release.id, release]),
  );

  return groups.map((entry) => ({
    releaseId: entry.releaseId || "",
    count: entry._count._all,
    release: entry.releaseId ? releaseMap.get(entry.releaseId) || null : null,
  }));
}

async function incrementReleaseAnalyticsCounter(
  tx: Prisma.TransactionClient,
  releaseId: string,
  action: AnalyticsAction,
  checkedAt: Date,
) {
  if (action === "VOTE") {
    return getReleaseReactionSnapshot(tx, releaseId);
  }

  if (action === "REACTION_POSITIVE" || action === "REACTION_NEGATIVE") {
    return getReleaseReactionSnapshot(tx, releaseId);
  }

  const data =
    action === "OPEN"
      ? { openCount: { increment: 1 }, analyticsUpdatedAt: checkedAt }
      : action === "LISTEN_CLICK"
        ? { listenClickCount: { increment: 1 }, analyticsUpdatedAt: checkedAt }
        : { shareCount: { increment: 1 }, analyticsUpdatedAt: checkedAt };

  await tx.release.update({
    where: { id: releaseId },
    data,
  });

  return getReleaseReactionSnapshot(tx, releaseId);
}

async function persistReleaseReaction(
  tx: Prisma.TransactionClient,
  input: {
    releaseId: string;
    deviceHash: string;
    action: Extract<AnalyticsAction, "REACTION_POSITIVE" | "REACTION_NEGATIVE">;
  },
) {
  const nextValue =
    input.action === "REACTION_POSITIVE"
      ? ReleaseReactionValue.POSITIVE
      : ReleaseReactionValue.NEGATIVE;

  const existing = await tx.releaseReaction.findUnique({
    where: {
      releaseId_deviceHash: {
        releaseId: input.releaseId,
        deviceHash: input.deviceHash,
      },
    },
    select: {
      value: true,
    },
  });

  if (existing?.value === nextValue) {
    return {
      changed: false,
      counters: await getReleaseReactionSnapshot(tx, input.releaseId),
    };
  }

  await tx.releaseReaction.upsert({
    where: {
      releaseId_deviceHash: {
        releaseId: input.releaseId,
        deviceHash: input.deviceHash,
      },
    },
    update: {
      value: nextValue,
    },
    create: {
      releaseId: input.releaseId,
      deviceHash: input.deviceHash,
      value: nextValue,
    },
  });

  const [positiveCount, negativeCount] = await Promise.all([
    tx.releaseReaction.count({
      where: {
        releaseId: input.releaseId,
        value: ReleaseReactionValue.POSITIVE,
      },
    }),
    tx.releaseReaction.count({
      where: {
        releaseId: input.releaseId,
        value: ReleaseReactionValue.NEGATIVE,
      },
    }),
  ]);

  await tx.release.update({
    where: {
      id: input.releaseId,
    },
    data: {
      positiveReactionCount: positiveCount,
      negativeReactionCount: negativeCount,
      analyticsUpdatedAt: new Date(),
    },
  });

  return {
    changed: true,
    counters: {
      positiveReactionCount: positiveCount,
      negativeReactionCount: negativeCount,
    },
  };
}

async function getReleaseReactionSnapshot(tx: Prisma.TransactionClient, releaseId: string) {
  const release = await tx.release.findUnique({
    where: { id: releaseId },
    select: {
      positiveReactionCount: true,
      negativeReactionCount: true,
      openCount: true,
      listenClickCount: true,
      shareCount: true,
    },
  });

  return release;
}

async function checkAnalyticsDebounce(
  tx: Prisma.TransactionClient,
  input: {
    releaseId: string;
    action: AnalyticsAction;
    deviceHash: string;
    platform: string | null;
    href: string | null;
    now: Date;
  },
) {
  const windowMs = ANALYTICS_DEBOUNCE_WINDOWS[input.action];
  if (!windowMs) {
    return false;
  }

  const key = buildActionLockKey(input);
  const existing = await tx.analyticsActionLock.findUnique({
    where: { key },
    select: { updatedAt: true },
  });

  if (existing && input.now.getTime() - existing.updatedAt.getTime() < windowMs) {
    return true;
  }

  await tx.analyticsActionLock.upsert({
    where: { key },
    update: {
      platform: input.platform,
    },
    create: {
      key,
      releaseId: input.releaseId,
      action: AnalyticsEventType[input.action],
      deviceHash: input.deviceHash,
      platform: input.platform,
    },
  });

  return false;
}

async function persistProductionAlerts(alerts: ProductionAlert[]) {
  const activeKeys = new Set(alerts.map((alert) => alert.key));
  const existing = await prisma.opsAlert.findMany({
    select: {
      key: true,
      status: true,
      firstTriggeredAt: true,
      severity: true,
      title: true,
      message: true,
      metricValue: true,
      contextJson: true,
    },
  });
  const existingMap = new Map(existing.map((item) => [item.key, item]));
  const now = new Date();

  for (const alert of alerts) {
    const current = existingMap.get(alert.key);
    const nextContextJson = alert.context ? JSON.stringify(alert.context) : null;
    const hasMaterialChange =
      !current ||
      current.status !== "OPEN" ||
      current.severity !== alert.severity ||
      current.title !== alert.title ||
      current.message !== alert.message ||
      current.metricValue !== (alert.metricValue ?? null) ||
      current.contextJson !== nextContextJson;

    await prisma.opsAlert.upsert({
      where: { key: alert.key },
      update: {
        severity: alert.severity,
        status: "OPEN",
        title: alert.title,
        message: alert.message,
        metricValue: alert.metricValue ?? null,
        contextJson: nextContextJson,
        ...(hasMaterialChange ? { lastTriggeredAt: now } : {}),
        resolvedAt: null,
      },
      create: {
        key: alert.key,
        severity: alert.severity,
        status: "OPEN",
        title: alert.title,
        message: alert.message,
        metricValue: alert.metricValue ?? null,
        contextJson: nextContextJson,
        firstTriggeredAt: current?.firstTriggeredAt || now,
        lastTriggeredAt: now,
      },
    });
  }

  for (const item of existing) {
    if (item.status !== "OPEN" || activeKeys.has(item.key)) {
      continue;
    }

    await prisma.opsAlert.update({
      where: { key: item.key },
      data: {
        status: "RESOLVED",
        resolvedAt: now,
      },
    });
  }
}

async function deliverPendingAlertNotifications() {
  const webhookTargets = getAlertWebhookTargets();
  if (webhookTargets.length === 0) {
    return;
  }

  const now = Date.now();
  const alerts = await prisma.opsAlert.findMany({
    where: {
      status: "OPEN",
      OR: [
        { lastNotifiedAt: null },
        { lastNotifiedAt: { lt: new Date(now - ALERT_NOTIFICATION_COOLDOWN_MS) } },
      ],
    },
    orderBy: [{ severity: "desc" }, { lastTriggeredAt: "desc" }],
    take: 8,
  });

  for (const alert of alerts) {
    if (alert.lastNotifiedAt && alert.lastNotifiedAt.getTime() >= alert.lastTriggeredAt.getTime()) {
      continue;
    }

    const delivered = await sendAlertNotification(alert, webhookTargets);
    if (!delivered) {
      continue;
    }

    await prisma.opsAlert.update({
      where: { key: alert.key },
      data: {
        lastNotifiedAt: new Date(),
        notificationCount: {
          increment: 1,
        },
      },
    });
  }
}

async function sendAlertNotification(
  alert: {
    key: string;
    severity: string;
    title: string;
    message: string;
    metricValue: number | null;
    contextJson: string | null;
    lastTriggeredAt: Date;
  },
  webhookTargets: Array<{ type: "discord" | "slack"; url: string }>,
) {
  const context = parseAlertContext(alert.contextJson);
  const detailLines = [
    alert.message,
    alert.metricValue !== null ? `Metric: ${alert.metricValue}` : null,
    context?.runUrl ? `Run: ${context.runUrl}` : null,
    context?.lastFailureAt ? `Failure: ${context.lastFailureAt}` : null,
    context?.lastError ? `Error: ${String(context.lastError).slice(0, 280)}` : null,
  ].filter((item): item is string => Boolean(item));

  const results = await Promise.all(
    webhookTargets.map(async (target) => {
      const payload =
        target.type === "discord"
          ? {
              username: "MooSQA Ops",
              embeds: [
                {
                  title: `${alert.severity}: ${alert.title}`,
                  description: detailLines.join("\n"),
                  color: alert.severity === "CRITICAL" ? 15158332 : 16098851,
                  timestamp: alert.lastTriggeredAt.toISOString(),
                },
              ],
            }
          : {
              text: `MooSQA alert: ${alert.severity} - ${alert.title}\n${detailLines.join("\n")}`,
            };

      try {
        const response = await fetch(target.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          cache: "no-store",
        });
        return response.ok;
      } catch {
        return false;
      }
    }),
  );

  return results.some(Boolean);
}

function getAlertWebhookTargets() {
  const targets: Array<{ type: "discord" | "slack"; url: string }> = [];

  if (process.env.DISCORD_ALERT_WEBHOOK_URL) {
    targets.push({
      type: "discord",
      url: process.env.DISCORD_ALERT_WEBHOOK_URL,
    });
  }

  if (process.env.SLACK_ALERT_WEBHOOK_URL) {
    targets.push({
      type: "slack",
      url: process.env.SLACK_ALERT_WEBHOOK_URL,
    });
  }

  return targets;
}

function parseAlertContext(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function shouldDebounceAnalyticsAction(action: AnalyticsAction) {
  return action !== "VOTE";
}

function isReactionAction(action: AnalyticsAction): action is "REACTION_POSITIVE" | "REACTION_NEGATIVE" {
  return action === "REACTION_POSITIVE" || action === "REACTION_NEGATIVE";
}

function buildActionLockKey(input: {
  releaseId: string;
  action: AnalyticsAction;
  deviceHash: string;
  platform: string | null;
  href: string | null;
}) {
  const hrefKey = input.href ? sanitizeSourcePath(input.href) || input.href.slice(0, 80) : "";
  return [
    input.releaseId,
    input.action,
    input.deviceHash,
    input.platform || "",
    hrefKey,
  ].join(":");
}

function buildDeviceHash(request: Request | null | undefined, deviceKey: string | null | undefined) {
  const key = (deviceKey || "").trim();
  const forwardedFor = request?.headers.get("x-forwarded-for") || "";
  const realIp = request?.headers.get("x-real-ip") || "";
  const cfIp = request?.headers.get("cf-connecting-ip") || "";
  const ip =
    forwardedFor.split(",")[0]?.trim() ||
    realIp.trim() ||
    cfIp.trim() ||
    "anonymous";
  const userAgent = request?.headers.get("user-agent")?.slice(0, 120) || "unknown";
  const raw = `${ip}|${userAgent}|${key}`;

  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

function sanitizeSourcePath(value: string | null | undefined) {
  const normalized = value?.trim() || "";
  if (!normalized.startsWith("/")) {
    return null;
  }

  return normalized.slice(0, 280);
}
