import {
  createRateLimitResponse,
  getRateLimitIdentity,
  takeMemoryRateLimit,
  withRateLimitHeaders,
} from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { fetchYouTubeVideoMetricsByIds, isYouTubeDataApiConfigured } from "@/lib/youtube-data-api";
import {
  hasYouTubeMetadataSource,
  shouldRefreshVisibleYouTubeStats,
} from "@/lib/youtube-metadata";
import { extractYouTubeVideoId } from "@/lib/youtube-video";

const YOUTUBE_STATS_RATE_LIMIT = {
  key: "api-youtube-stats",
  windowMs: 60_000,
  max: 40,
} as const;
const MAX_RELEASE_IDS = 36;

export async function POST(request: Request) {
  const rateLimit = takeMemoryRateLimit(YOUTUBE_STATS_RATE_LIMIT, getRateLimitIdentity(request));
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit, "Too many YouTube stats requests.");
  }

  const releaseIds = parseReleaseIds(await readJsonBody(request));
  if (releaseIds.length === 0) {
    return withRateLimitHeaders(Response.json({ metrics: [] }, {
      headers: { "Cache-Control": "no-store" },
    }), rateLimit);
  }

  const releases = await prisma.release.findMany({
    where: {
      id: { in: releaseIds },
      isHidden: false,
    },
    select: {
      id: true,
      sourceUrl: true,
      youtubeUrl: true,
      youtubeMusicUrl: true,
      youtubeViewCount: true,
      youtubePublishedAt: true,
      youtubeMetadataUpdatedAt: true,
      metadataEnrichedAt: true,
    },
  });
  const now = new Date();
  const byVideoId = new Map<string, typeof releases[number]>();
  const videoIdsToRefresh: string[] = [];

  for (const release of releases) {
    if (!hasYouTubeMetadataSource(release)) {
      continue;
    }

    const videoId =
      extractYouTubeVideoId(release.youtubeUrl) ||
      extractYouTubeVideoId(release.youtubeMusicUrl) ||
      extractYouTubeVideoId(release.sourceUrl);
    if (!videoId) {
      continue;
    }

    byVideoId.set(videoId, release);
    if (shouldRefreshVisibleYouTubeStats(release, now)) {
      videoIdsToRefresh.push(videoId);
    }
  }

  const refreshedMetrics = isYouTubeDataApiConfigured()
    ? await fetchYouTubeVideoMetricsByIds(videoIdsToRefresh)
    : [];
  const updatedByReleaseId = new Map<string, YouTubeStatsMetric>();

  for (const metric of refreshedMetrics) {
    const release = byVideoId.get(metric.videoId);
    if (!release) {
      continue;
    }

    const nextYoutubeUrl = release.youtubeUrl || metric.canonicalUrl;
    const nextPublishedAt = metric.publishedAt || release.youtubePublishedAt;
    const nextViewCount = metric.viewCount || release.youtubeViewCount;
    const shouldUpdate =
      nextYoutubeUrl !== release.youtubeUrl ||
      nextViewCount !== release.youtubeViewCount ||
      !sameDate(nextPublishedAt, release.youtubePublishedAt) ||
      !sameDate(now, release.youtubeMetadataUpdatedAt);

    if (shouldUpdate) {
      await prisma.release.update({
        where: { id: release.id },
        data: {
          youtubeUrl: nextYoutubeUrl,
          youtubeViewCount: nextViewCount,
          youtubePublishedAt: nextPublishedAt,
          youtubeMetadataUpdatedAt: now,
        },
      });
    }

    updatedByReleaseId.set(release.id, {
      releaseId: release.id,
      youtubeViewCount: nextViewCount,
      youtubePublishedAt: nextPublishedAt?.toISOString() || null,
      youtubeMetadataUpdatedAt: now.toISOString(),
    });
  }

  const metrics = releases
    .filter(hasYouTubeMetadataSource)
    .map((release) => updatedByReleaseId.get(release.id) || {
      releaseId: release.id,
      youtubeViewCount: release.youtubeViewCount,
      youtubePublishedAt: release.youtubePublishedAt?.toISOString() || null,
      youtubeMetadataUpdatedAt: release.youtubeMetadataUpdatedAt?.toISOString() || null,
    });

  return withRateLimitHeaders(Response.json({
    metrics,
    refreshed: refreshedMetrics.length,
    youtubeApiConfigured: isYouTubeDataApiConfigured(),
    refreshAttempted: videoIdsToRefresh.length,
  }, {
    headers: { "Cache-Control": "no-store" },
  }), rateLimit);
}

type YouTubeStatsMetric = {
  releaseId: string;
  youtubeViewCount: number | null;
  youtubePublishedAt: string | null;
  youtubeMetadataUpdatedAt: string | null;
};

async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function parseReleaseIds(body: unknown) {
  if (!body || typeof body !== "object" || !("releaseIds" in body)) {
    return [];
  }

  const releaseIds = (body as { releaseIds?: unknown }).releaseIds;
  if (!Array.isArray(releaseIds)) {
    return [];
  }

  return [...new Set(releaseIds)]
    .filter((id): id is string => typeof id === "string" && /^[a-z0-9]{8,40}$/i.test(id))
    .slice(0, MAX_RELEASE_IDS);
}

function sameDate(left: Date | null, right: Date | null) {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.getTime() === right.getTime();
}
