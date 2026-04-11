import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";

import { AnalyticsEventType } from "@/generated/prisma/enums";
import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";

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

const ANALYTICS_LOOKBACK_HOURS = 24;

export async function recordAnalyticsEvent(payload: AnalyticsPayload) {
  await ensureDatabase();

  await prisma.analyticsEvent.create({
    data: {
      releaseId: payload.releaseId || null,
      action: AnalyticsEventType[payload.action],
      platform: payload.platform || null,
      href: payload.href || null,
      sourcePath: sanitizeSourcePath(payload.sourcePath),
      deviceHash: buildDeviceHash(payload.request, payload.deviceKey),
      metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
    },
  });
}

export async function getAnalyticsOverview(hours = ANALYTICS_LOOKBACK_HOURS) {
  await ensureDatabase();
  return getCachedAnalyticsOverview(Math.max(1, Math.floor(hours)));
}

const getCachedAnalyticsOverview = unstable_cache(
  async (hours: number) => {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const [counts, topReleases, platformCounts] = await Promise.all([
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
    };
  },
  ["analytics-overview"],
  {
    revalidate: 60,
    tags: ["analytics"],
  },
);

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
