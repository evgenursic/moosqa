import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";

import {
  AlertDeliveryChannel,
  AnalyticsEventType,
  ReleaseReactionValue,
  WorkflowRunStatus,
} from "@/generated/prisma/enums";
import { type Prisma } from "@/generated/prisma/client";
import {
  buildArchiveHref,
  buildPlatformArchiveHref,
  buildSignalArchiveHref,
  buildTrendingGenreHref,
  type PlatformArchiveSlug,
  type SignalArchiveSlug,
} from "@/lib/archive-links";
import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getQualityDashboardData } from "@/lib/quality-dashboard";
import {
  getReleaseListingItemsByIds,
  getSectionReleasesForInsights,
  releaseSectionDefinitions,
  type ReleaseListingItem,
  type ReleaseSectionKey,
} from "@/lib/release-sections";
import { getSyncStatusSummary } from "@/lib/sync-releases";
import { computeTrendingScore } from "@/lib/trending-score";

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

type GenreTrendingItem = {
  genre: string;
  count: number;
  release: Awaited<ReturnType<typeof getSectionReleasesForInsights>>[number] | null;
};

type PublicPlatformLabel = "Bandcamp" | "YouTube" | "YouTube Music";
const PLATFORM_ARCHIVE_PAGE_SIZE = 24;
const SIGNAL_ARCHIVE_PAGE_SIZE = 24;

type SectionTrendLeaderItem = {
  section: ReleaseSectionKey;
  title: string;
  entries: AnalyticsInsightItem[];
};

type DailyAnalyticsBucket = {
  dateKey: string;
  label: string;
  total: number;
  counts: Record<AnalyticsAction, number>;
};

type DailyPlatformBucket = {
  dateKey: string;
  label: string;
  total: number;
  counts: Record<PublicPlatformLabel, number>;
};

const ANALYTICS_LOOKBACK_HOURS = 24;
const ANALYTICS_DAILY_WINDOW_DAYS = 14;
const REPAIR_QUEUE_ALERT_THRESHOLD = 28;
const STALE_METADATA_ALERT_THRESHOLD = 34;
const ANALYTICS_TAG = "analytics";
const ALERT_NOTIFICATION_COOLDOWN_MS = 1000 * 60 * 30;
const PUBLIC_PLATFORM_LABELS: readonly PublicPlatformLabel[] = ["Bandcamp", "YouTube", "YouTube Music"] as const;
const TREND_SECTION_KEYS: ReleaseSectionKey[] = [
  "latest",
  "top-engaged",
  "albums",
  "eps",
  "live",
] as const;

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

export async function getPlatformArchivePage(platform: PlatformArchiveSlug, requestedPage = 1) {
  await ensureDatabase();
  return getCachedPlatformArchivePage(platform, requestedPage);
}

export async function getSignalArchivePage(signal: SignalArchiveSlug, requestedPage = 1) {
  await ensureDatabase();
  return getCachedSignalArchivePage(signal, requestedPage);
}

export function getPlatformLabelFromSlug(platform: PlatformArchiveSlug): PublicPlatformLabel {
  if (platform === "bandcamp") {
    return "Bandcamp";
  }
  if (platform === "youtube-music") {
    return "YouTube Music";
  }

  return "YouTube";
}

export type AlertDeliveryTestChannel = "discord" | "slack" | "email" | "all";

export async function sendProductionAlertTest(channel: AlertDeliveryTestChannel) {
  const webhookTargets = getAlertWebhookTargets();
  const emailTarget = getAlertEmailTarget();
  const testAlert = {
    key: `manual-alert-test-${Date.now()}`,
    severity: "INFO",
    title: "Manual alert delivery test",
    message: "This is a private MooSQA alert delivery test from the ops flow.",
    metricValue: null,
    contextJson: JSON.stringify({
      source: "ops-debug",
      triggeredAt: new Date().toISOString(),
    }),
    lastTriggeredAt: new Date(),
  };

  const requestedWebhookTargets =
    channel === "all"
      ? webhookTargets
      : webhookTargets.filter((target) => target.type === channel);
  const webhookResults = await Promise.all(
    requestedWebhookTargets.map(async (target) => ({
      channel: target.type,
      configured: true,
      delivered: await sendAlertNotification(testAlert, [target], { isTest: true }),
    })),
  );
  const missingWebhookResults =
    channel === "discord" || channel === "slack"
      ? !webhookTargets.some((target) => target.type === channel)
        ? [{ channel, configured: false, delivered: false }]
        : []
      : [];

  const emailResults =
    channel === "email" || channel === "all"
      ? [
          {
            channel: "email" as const,
            configured: Boolean(emailTarget),
            delivered: emailTarget ? await sendAlertSummaryEmail([testAlert], emailTarget, { isTest: true }) : false,
          },
        ]
      : [];

  const results = [...webhookResults, ...missingWebhookResults, ...emailResults];

  await Promise.all(
    missingWebhookResults.map((entry) =>
      logAlertDeliveryAttempt({
        alertKey: testAlert.key,
        channel: entry.channel === "discord" ? AlertDeliveryChannel.DISCORD : AlertDeliveryChannel.SLACK,
        destination: null,
        success: false,
        responseStatus: null,
        message: "Channel not configured",
        isTest: true,
      }),
    ),
  );
  if ((channel === "email" || channel === "all") && !emailTarget) {
    await logAlertDeliveryAttempt({
      alertKey: testAlert.key,
      channel: AlertDeliveryChannel.EMAIL,
      destination: null,
      success: false,
      responseStatus: null,
      message: "Channel not configured",
      isTest: true,
    });
  }

  return {
    ok: results.some((entry) => entry.delivered),
    results,
  };
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
    const dailySince = new Date(Date.now() - ANALYTICS_DAILY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const [counts, topReleases, platformCounts, aggregatedTopReleases, recentDailyEvents, recentPlatformEvents] = await Promise.all([
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
      prisma.analyticsEvent.findMany({
        where: {
          createdAt: {
            gte: dailySince,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          action: true,
          createdAt: true,
        },
      }),
      prisma.analyticsEvent.findMany({
        where: {
          createdAt: {
            gte: dailySince,
          },
          action: AnalyticsEventType.LISTEN_CLICK,
          platform: {
            in: [...PUBLIC_PLATFORM_LABELS],
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          platform: true,
          createdAt: true,
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
      daily: buildDailyAnalyticsBuckets(recentDailyEvents, ANALYTICS_DAILY_WINDOW_DAYS),
      platformDaily: buildDailyPlatformBuckets(recentPlatformEvents, ANALYTICS_DAILY_WINDOW_DAYS),
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

    const [
      openedToday,
      sharedThisWeek,
      listenedThisWeek,
      platformLeaderboards,
      latestReleases,
      trendingNow,
      trendingByGenre,
      sectionTrendLeaders,
    ] = await Promise.all([
      getTopAnalyticsInsightByAction("OPEN", todayStart, 1),
      getTopAnalyticsInsightByAction("SHARE", weekStart, 1),
      getTopAnalyticsInsightByAction("LISTEN_CLICK", weekStart, 1),
      Promise.all(
        PUBLIC_PLATFORM_LABELS.map(async (platform) => ({
          platform,
          entries: await getTopAnalyticsInsightByAction("LISTEN_CLICK", weekStart, 3, platform),
        })),
      ),
      getSectionReleasesForInsights("latest"),
      getTrendingAnalyticsReleases(6),
      getTrendingGenres(5),
      getSectionTrendLeaders(2),
    ]);

    return {
      mostOpenedToday: openedToday[0] || null,
      mostSharedThisWeek: sharedThisWeek[0] || null,
      mostClickedToListen: listenedThisWeek[0] || null,
      platformHighlights: platformLeaderboards.map((item) => ({
        platform: item.platform,
        entry: item.entries[0] || null,
      })),
      platformLeaderboards,
      trendingNow,
      trendingByGenre,
      sectionTrendLeaders,
      audiencePulseLinks: buildAudiencePulseLinks({
        mostOpenedToday: openedToday[0] || null,
        mostSharedThisWeek: sharedThisWeek[0] || null,
        mostClickedToListen: listenedThisWeek[0] || null,
      }),
      trendingGenreLinks: buildTrendingGenreLinks(trendingByGenre),
      trendingArchiveLinks: buildSectionTrendLinks(sectionTrendLeaders),
      fallbackLatest: latestReleases.slice(0, 3),
    };
  },
  ["public-analytics-insights"],
  {
    revalidate: 300,
    tags: [ANALYTICS_TAG, "releases"],
  },
);

const getCachedPlatformArchivePage = unstable_cache(
  async (platform: PlatformArchiveSlug, requestedPage: number) => {
    const label = getPlatformLabelFromSlug(platform);
    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const groups = await prisma.analyticsEvent.groupBy({
      by: ["releaseId"],
      where: {
        action: AnalyticsEventType.LISTEN_CLICK,
        createdAt: {
          gte: weekStart,
        },
        platform: label,
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
      take: 120,
    });

    const releaseIds = groups
      .map((entry) => entry.releaseId)
      .filter((entry): entry is string => Boolean(entry));
    const releaseMap = new Map(
      (await getReleaseListingItemsByIds(releaseIds)).map((release) => [release.id, release]),
    );
    const entries = groups
      .map((entry) => ({
        releaseId: entry.releaseId || "",
        count: entry._count._all,
        release: entry.releaseId ? releaseMap.get(entry.releaseId) || null : null,
      }))
      .filter((entry) => entry.release);

    const pageCount = Math.max(1, Math.ceil(entries.length / PLATFORM_ARCHIVE_PAGE_SIZE));
    const page = clampPageNumber(requestedPage, pageCount);
    const start = (page - 1) * PLATFORM_ARCHIVE_PAGE_SIZE;

    return {
      platform,
      label,
      title: `${label} trending`,
      description: `The most clicked ${label} releases on MooSQA over the last 7 days.`,
      page,
      pageCount,
      total: entries.length,
      entries: entries.slice(start, start + PLATFORM_ARCHIVE_PAGE_SIZE),
      canonicalHref: buildPlatformArchiveHref(platform, page),
    };
  },
  ["platform-archive-page"],
  {
    revalidate: 300,
    tags: [ANALYTICS_TAG, "releases"],
  },
);

const getCachedSignalArchivePage = unstable_cache(
  async (signal: SignalArchiveSlug, requestedPage: number) => {
    const config = getSignalArchiveConfig(signal);
    const groups = await prisma.analyticsEvent.groupBy({
      by: ["releaseId"],
      where: {
        action: config.action,
        createdAt: {
          gte: config.since,
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
      take: 140,
    });

    const releaseIds = groups
      .map((entry) => entry.releaseId)
      .filter((entry): entry is string => Boolean(entry));
    const releaseMap = new Map(
      (await getReleaseListingItemsByIds(releaseIds)).map((release) => [release.id, release]),
    );
    const entries = groups
      .map((entry) => ({
        releaseId: entry.releaseId || "",
        count: entry._count._all,
        release: entry.releaseId ? releaseMap.get(entry.releaseId) || null : null,
      }))
      .filter((entry) => entry.release);

    const pageCount = Math.max(1, Math.ceil(entries.length / SIGNAL_ARCHIVE_PAGE_SIZE));
    const page = clampPageNumber(requestedPage, pageCount);
    const start = (page - 1) * SIGNAL_ARCHIVE_PAGE_SIZE;

    return {
      signal,
      title: config.title,
      kicker: config.kicker,
      description: config.description,
      page,
      pageCount,
      total: entries.length,
      entries: entries.slice(start, start + SIGNAL_ARCHIVE_PAGE_SIZE),
      canonicalHref: buildSignalArchiveHref(signal, page),
    };
  },
  ["signal-archive-page"],
  {
    revalidate: 300,
    tags: [ANALYTICS_TAG, "releases"],
  },
);

function clampPageNumber(value: number, pageCount: number) {
  if (!Number.isFinite(value) || value < 1) {
    return 1;
  }

  if (value > pageCount) {
    return pageCount;
  }

  return Math.floor(value);
}

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

  const releases = await getReleaseListingItemsByIds(releaseIds);
  const releaseMap = new Map(releases.map((release) => [release.id, release]));

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
  const emailTarget = getAlertEmailTarget();
  if (webhookTargets.length === 0 && !emailTarget) {
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

  const deliveredKeys = new Set<string>();

  for (const alert of alerts) {
    if (alert.lastNotifiedAt && alert.lastNotifiedAt.getTime() >= alert.lastTriggeredAt.getTime()) {
      continue;
    }

    const delivered = await sendAlertNotification(alert, webhookTargets);
    if (!delivered) {
      continue;
    }

    deliveredKeys.add(alert.key);
  }

  if (emailTarget) {
    const emailDelivered = await sendAlertSummaryEmail(alerts, emailTarget);
    if (emailDelivered) {
      for (const alert of alerts) {
        deliveredKeys.add(alert.key);
      }
    }
  }

  if (deliveredKeys.size === 0) {
    return;
  }

  await prisma.opsAlert.updateMany({
    where: {
      key: {
        in: [...deliveredKeys],
      },
    },
    data: {
      lastNotifiedAt: new Date(),
    },
  });

  await Promise.all(
    [...deliveredKeys].map((key) =>
      prisma.opsAlert.update({
        where: { key },
        data: {
          notificationCount: {
            increment: 1,
          },
        },
      })),
  );
}

async function getTrendingAnalyticsReleases(limit: number) {
  const recentCutoff = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
  const releases = await prisma.release.findMany({
    where: {
      OR: [
        { analyticsUpdatedAt: { gte: recentCutoff } },
        { openCount: { gt: 0 } },
        { listenClickCount: { gt: 0 } },
        { shareCount: { gt: 0 } },
        { positiveReactionCount: { gt: 0 } },
      ],
    },
    orderBy: [
      { analyticsUpdatedAt: "desc" },
      { openCount: "desc" },
      { listenClickCount: "desc" },
      { shareCount: "desc" },
    ],
    take: 40,
    select: {
      id: true,
      publishedAt: true,
      analyticsUpdatedAt: true,
      openCount: true,
      listenClickCount: true,
      shareCount: true,
      positiveReactionCount: true,
      negativeReactionCount: true,
    },
  });

  const ranked = releases
    .map((release) => ({
      releaseId: release.id,
      count: computeTrendingScore(release),
    }))
    .filter((entry) => entry.count > 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, limit);

  const releaseMap = new Map(
    (await getReleaseListingItemsByIds(ranked.map((entry) => entry.releaseId))).map((release) => [release.id, release]),
  );

  return ranked.map((entry) => ({
    releaseId: entry.releaseId,
    count: Math.round(entry.count),
    release: releaseMap.get(entry.releaseId) || null,
  }));
}

async function getTrendingGenres(limit: number): Promise<GenreTrendingItem[]> {
  const recentCutoff = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
  const releases = await prisma.release.findMany({
    where: {
      publishedAt: {
        gte: recentCutoff,
      },
      genreName: {
        not: null,
      },
      OR: [
        { openCount: { gt: 0 } },
        { listenClickCount: { gt: 0 } },
        { shareCount: { gt: 0 } },
        { positiveReactionCount: { gt: 0 } },
      ],
    },
    orderBy: [{ analyticsUpdatedAt: "desc" }, { publishedAt: "desc" }],
    take: 120,
    select: {
      id: true,
      genreName: true,
      publishedAt: true,
      analyticsUpdatedAt: true,
      openCount: true,
      listenClickCount: true,
      shareCount: true,
      positiveReactionCount: true,
      negativeReactionCount: true,
    },
  });

  const genreMap = new Map<
    string,
    {
      genre: string;
      count: number;
      releaseId: string;
      releaseScore: number;
    }
  >();

  for (const release of releases) {
    const genre = release.genreName?.trim();
    if (!genre) {
      continue;
    }

    const score = computeTrendingScore(release);
    if (score <= 0) {
      continue;
    }

    const current = genreMap.get(genre);
    if (!current) {
      genreMap.set(genre, {
        genre,
        count: score,
        releaseId: release.id,
        releaseScore: score,
      });
      continue;
    }

    current.count += score;
    if (score > current.releaseScore) {
      current.releaseId = release.id;
      current.releaseScore = score;
    }
  }

  const ranked = [...genreMap.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, limit);

  const releaseMap = new Map(
    (await getReleaseListingItemsByIds(ranked.map((entry) => entry.releaseId))).map((release) => [release.id, release]),
  );

  return ranked.map((entry) => ({
    genre: entry.genre,
    count: Math.round(entry.count),
    release: releaseMap.get(entry.releaseId) || null,
  }));
}

async function getSectionTrendLeaders(limit: number): Promise<SectionTrendLeaderItem[]> {
  const sections = await Promise.all(
    TREND_SECTION_KEYS.map(async (section) => {
      const releases = await getSectionReleasesForInsights(section);
      const entries = releases
        .slice(0, 96)
        .map((release) => ({
          releaseId: release.id,
          count: computeTrendingScore(release),
          release,
        }))
        .filter((entry) => entry.count > 0)
        .sort((left, right) => right.count - left.count)
        .slice(0, limit)
        .map((entry) => ({
          releaseId: entry.releaseId,
          count: Math.round(entry.count),
          release: entry.release as ReleaseListingItem,
        }));

      return {
        section,
        title: releaseSectionDefinitions[section].title,
        entries,
      };
    }),
  );

  return sections.filter((section) => section.entries.length > 0);
}

function buildDailyAnalyticsBuckets(
  events: Array<{ action: AnalyticsEventType; createdAt: Date }>,
  days: number,
) {
  const actionKeys: AnalyticsAction[] = [
    "OPEN",
    "LISTEN_CLICK",
    "VOTE",
    "SHARE",
    "REACTION_POSITIVE",
    "REACTION_NEGATIVE",
  ];
  const buckets = new Map<string, DailyAnalyticsBucket>();

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - index);
    const key = date.toISOString().slice(0, 10);
    buckets.set(key, {
      dateKey: key,
      label: date.toLocaleDateString("en-GB", { month: "short", day: "numeric" }),
      total: 0,
      counts: {
        OPEN: 0,
        LISTEN_CLICK: 0,
        VOTE: 0,
        SHARE: 0,
        REACTION_POSITIVE: 0,
        REACTION_NEGATIVE: 0,
      },
    });
  }

  for (const event of events) {
    const key = event.createdAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) {
      continue;
    }

    const action = event.action as AnalyticsAction;
    if (!actionKeys.includes(action)) {
      continue;
    }

    bucket.counts[action] += 1;
    bucket.total += 1;
  }

  return [...buckets.values()];
}

function buildDailyPlatformBuckets(
  events: Array<{ platform: string | null; createdAt: Date }>,
  days: number,
) {
  const buckets = new Map<string, DailyPlatformBucket>();

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - index);
    const key = date.toISOString().slice(0, 10);
    buckets.set(key, {
      dateKey: key,
      label: date.toLocaleDateString("en-GB", { month: "short", day: "numeric" }),
      total: 0,
      counts: {
        Bandcamp: 0,
        YouTube: 0,
        "YouTube Music": 0,
      },
    });
  }

  for (const event of events) {
    const key = event.createdAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket || !event.platform || !isPublicPlatformLabel(event.platform)) {
      continue;
    }

    bucket.counts[event.platform] += 1;
    bucket.total += 1;
  }

  return [...buckets.values()];
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
  options?: {
    isTest?: boolean;
  },
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
        await logAlertDeliveryAttempt({
          alertKey: alert.key,
          channel: target.type === "discord" ? AlertDeliveryChannel.DISCORD : AlertDeliveryChannel.SLACK,
          destination: sanitizeDeliveryDestination(target.url),
          success: response.ok,
          responseStatus: response.status,
          message: response.ok ? "Delivered" : `HTTP ${response.status}`,
          isTest: Boolean(options?.isTest),
        });
        return response.ok;
      } catch {
        await logAlertDeliveryAttempt({
          alertKey: alert.key,
          channel: target.type === "discord" ? AlertDeliveryChannel.DISCORD : AlertDeliveryChannel.SLACK,
          destination: sanitizeDeliveryDestination(target.url),
          success: false,
          responseStatus: null,
          message: "Network error",
          isTest: Boolean(options?.isTest),
        });
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

function getAlertEmailTarget() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = process.env.ALERT_EMAIL_TO?.trim();
  const from = process.env.ALERT_EMAIL_FROM?.trim();

  if (!apiKey || !to || !from) {
    return null;
  }

  return { apiKey, to, from };
}

async function sendAlertSummaryEmail(
  alerts: Array<{
    key: string;
    severity: string;
    title: string;
    message: string;
    metricValue: number | null;
    contextJson: string | null;
    lastTriggeredAt: Date;
  }>,
  target: {
    apiKey: string;
    to: string;
    from: string;
  },
  options?: {
    isTest?: boolean;
  },
) {
  if (alerts.length === 0) {
    return false;
  }

  const subject = `[MooSQA] ${alerts.length} active production alert${alerts.length === 1 ? "" : "s"}`;
  const lines = alerts.map((alert) => {
    const context = parseAlertContext(alert.contextJson);
    return [
      `${alert.severity}: ${alert.title}`,
      alert.message,
      alert.metricValue !== null ? `Metric: ${alert.metricValue}` : null,
      context?.runUrl ? `Run: ${context.runUrl}` : null,
      context?.lastFailureAt ? `Failure: ${context.lastFailureAt}` : null,
      context?.lastError ? `Error: ${String(context.lastError).slice(0, 320)}` : null,
    ]
      .filter((item): item is string => Boolean(item))
      .join("\n");
  });

  const text = `MooSQA production alerts\n\n${lines.join("\n\n---\n\n")}`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #182131;">
      <h2 style="margin:0 0 16px;">MooSQA production alerts</h2>
      ${alerts
        .map((alert) => {
          const context = parseAlertContext(alert.contextJson);
          const detailLines = [
            alert.message,
            alert.metricValue !== null ? `Metric: ${alert.metricValue}` : null,
            context?.runUrl ? `Run: ${context.runUrl}` : null,
            context?.lastFailureAt ? `Failure: ${context.lastFailureAt}` : null,
            context?.lastError ? `Error: ${String(context.lastError).slice(0, 320)}` : null,
          ]
            .filter((item): item is string => Boolean(item))
            .map((line) => `<div>${escapeHtml(line)}</div>`)
            .join("");

          return `
            <div style="border:1px solid #d8deea; padding:14px 16px; margin:0 0 14px;">
              <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.16em; color:#6b7386;">${escapeHtml(alert.severity)}</div>
              <div style="font-size:20px; margin-top:8px;">${escapeHtml(alert.title)}</div>
              <div style="margin-top:10px; color:#354055;">${detailLines}</div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;

  try {
    const idempotencyKey = createHash("sha256")
      .update(`ops-alert:${alerts.map((alert) => `${alert.key}:${alert.lastTriggeredAt.toISOString()}`).join("|")}`)
      .digest("hex");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${target.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from: target.from,
        to: [target.to],
        subject,
        text,
        html,
      }),
      cache: "no-store",
    });

    await logAlertDeliveryAttempt({
      alertKey: alerts[0]?.key || null,
      channel: AlertDeliveryChannel.EMAIL,
      destination: target.to,
      success: response.ok,
      responseStatus: response.status,
      message: response.ok ? "Delivered" : `HTTP ${response.status}`,
      isTest: Boolean(options?.isTest),
    });
    return response.ok;
  } catch {
    await logAlertDeliveryAttempt({
      alertKey: alerts[0]?.key || null,
      channel: AlertDeliveryChannel.EMAIL,
      destination: target.to,
      success: false,
      responseStatus: null,
      message: "Network error",
      isTest: Boolean(options?.isTest),
    });
    return false;
  }
}

async function logAlertDeliveryAttempt(input: {
  alertKey: string | null;
  channel: AlertDeliveryChannel;
  destination: string | null;
  success: boolean;
  responseStatus: number | null;
  message: string | null;
  isTest: boolean;
}) {
  try {
    await prisma.alertDeliveryLog.create({
      data: {
        alertKey: input.alertKey,
        channel: input.channel,
        destination: input.destination,
        success: input.success,
        responseStatus: input.responseStatus,
        message: input.message,
        isTest: input.isTest,
      },
    });
    revalidateTag("ops-dashboard", "max");
  } catch {
    // ignore logging failures to avoid blocking primary alert delivery
  }
}

function sanitizeDeliveryDestination(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isPublicPlatformLabel(value: string): value is PublicPlatformLabel {
  return PUBLIC_PLATFORM_LABELS.includes(value as PublicPlatformLabel);
}

function buildAudiencePulseLinks(input: {
  mostOpenedToday: AnalyticsInsightItem | null;
  mostSharedThisWeek: AnalyticsInsightItem | null;
  mostClickedToListen: AnalyticsInsightItem | null;
}) {
  return [
    {
      title: "Most opened today",
      count: input.mostOpenedToday?.count ?? 0,
      release: input.mostOpenedToday?.release || null,
    },
    {
      title: "Most shared this week",
      count: input.mostSharedThisWeek?.count ?? 0,
      release: input.mostSharedThisWeek?.release || null,
    },
    {
      title: "Most clicked to listen",
      count: input.mostClickedToListen?.count ?? 0,
      release: input.mostClickedToListen?.release || null,
    },
  ].filter((item) => item.release);
}

function buildTrendingGenreLinks(items: GenreTrendingItem[]) {
  return items.map((item) => ({
    title: item.genre,
    count: item.count,
    href: buildTrendingGenreHref(item.genre),
  }));
}

function buildSectionTrendLinks(items: SectionTrendLeaderItem[]) {
  return items.map((item) => ({
    section: item.section,
    title: `${item.title} trending`,
    href: buildArchiveHref(item.section, {
      view: "trending",
    }),
    count: item.entries.reduce((sum, entry) => sum + entry.count, 0),
  }));
}

function getSignalArchiveConfig(signal: SignalArchiveSlug) {
  if (signal === "shared") {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return {
      action: AnalyticsEventType.SHARE,
      since,
      title: "Most shared this week",
      kicker: "Public share signal",
      description: "The releases listeners share most often across the last 7 days.",
    };
  }

  if (signal === "listened") {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return {
      action: AnalyticsEventType.LISTEN_CLICK,
      since,
      title: "Most clicked to listen",
      kicker: "Public listening signal",
      description: "The releases that generate the most direct listening clicks this week.",
    };
  }

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  return {
    action: AnalyticsEventType.OPEN,
    since,
    title: "Most opened today",
    kicker: "Public open signal",
    description: "The releases opened most often today across the MooSQA feed.",
  };
}
