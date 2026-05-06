import {
  createRateLimitResponse,
  getRateLimitIdentity,
  takeMemoryRateLimit,
  withRateLimitHeaders,
} from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import {
  discoverYouTubeVideoMetric,
  fetchYouTubeVideoMetricsByIds,
  isYouTubeDataApiConfigured,
} from "@/lib/youtube-data-api";
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
const MAX_DISCOVERY_PER_REQUEST = readPositiveInt(
  process.env.YOUTUBE_VISIBLE_DISCOVERY_MAX_PER_REQUEST,
  6,
);
const DISCOVERY_RETRY_INTERVAL_MS = 1000 * 60 * 60 * 12;

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
      title: true,
      artistName: true,
      projectTitle: true,
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
  const discoveryCandidates: Array<typeof releases[number]> = [];

  for (const release of releases) {
    const videoId =
      extractYouTubeVideoId(release.youtubeUrl) ||
      extractYouTubeVideoId(release.youtubeMusicUrl) ||
      extractYouTubeVideoId(release.sourceUrl);

    if (videoId) {
      byVideoId.set(videoId, release);
      if (shouldRefreshVisibleYouTubeStats(release, now)) {
        videoIdsToRefresh.push(videoId);
      }
      continue;
    }

    if (shouldAttemptYouTubeDiscovery(release, now)) {
      discoveryCandidates.push(release);
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
      youtubeUrl: nextYoutubeUrl,
      youtubeViewCount: nextViewCount,
      youtubePublishedAt: nextPublishedAt?.toISOString() || null,
      youtubeMetadataUpdatedAt: now.toISOString(),
    });
  }

  const discoveredMetrics = isYouTubeDataApiConfigured()
    ? await discoverMissingYouTubeMetrics(discoveryCandidates.slice(0, MAX_DISCOVERY_PER_REQUEST), now)
    : [];
  for (const metric of discoveredMetrics) {
    updatedByReleaseId.set(metric.releaseId, metric);
  }

  const metrics = releases.map((release) => updatedByReleaseId.get(release.id) || {
    releaseId: release.id,
    youtubeUrl: release.youtubeUrl,
    youtubeViewCount: release.youtubeViewCount,
    youtubePublishedAt: release.youtubePublishedAt?.toISOString() || null,
    youtubeMetadataUpdatedAt: release.youtubeMetadataUpdatedAt?.toISOString() || null,
  });

  return withRateLimitHeaders(Response.json({
    metrics,
    refreshed: refreshedMetrics.length,
    discovered: discoveredMetrics.length,
    youtubeApiConfigured: isYouTubeDataApiConfigured(),
    refreshAttempted: videoIdsToRefresh.length,
    discoveryAttempted: Math.min(discoveryCandidates.length, MAX_DISCOVERY_PER_REQUEST),
  }, {
    headers: { "Cache-Control": "no-store" },
  }), rateLimit);
}

type YouTubeStatsMetric = {
  releaseId: string;
  youtubeUrl: string | null;
  youtubeViewCount: number | null;
  youtubePublishedAt: string | null;
  youtubeMetadataUpdatedAt: string | null;
};

async function discoverMissingYouTubeMetrics(
  releases: Array<{
    id: string;
    title: string;
    artistName: string | null;
    projectTitle: string | null;
  }>,
  now: Date,
) {
  const metrics: YouTubeStatsMetric[] = [];

  for (const release of releases) {
    const discovered = await discoverYouTubeVideoMetric({
      title: release.title,
      artistName: release.artistName,
      projectTitle: release.projectTitle,
    });

    if (!discovered) {
      await prisma.release.update({
        where: { id: release.id },
        data: { youtubeMetadataUpdatedAt: now },
      });
      continue;
    }

    await prisma.release.update({
      where: { id: release.id },
      data: {
        youtubeUrl: discovered.canonicalUrl,
        youtubeViewCount: discovered.viewCount,
        youtubePublishedAt: discovered.publishedAt,
        youtubeMetadataUpdatedAt: now,
      },
    });

    metrics.push({
      releaseId: release.id,
      youtubeUrl: discovered.canonicalUrl,
      youtubeViewCount: discovered.viewCount,
      youtubePublishedAt: discovered.publishedAt?.toISOString() || null,
      youtubeMetadataUpdatedAt: now.toISOString(),
    });
  }

  return metrics;
}

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

function shouldAttemptYouTubeDiscovery(
  release: {
    youtubeViewCount: number | null;
    youtubePublishedAt: Date | null;
    youtubeMetadataUpdatedAt: Date | null;
    metadataEnrichedAt: Date | null;
    sourceUrl: string;
    youtubeUrl: string | null;
    youtubeMusicUrl: string | null;
  },
  now: Date,
) {
  if (release.youtubeViewCount && release.youtubePublishedAt) {
    return false;
  }

  if (hasYouTubeMetadataSource(release)) {
    return shouldRefreshVisibleYouTubeStats(release, now);
  }

  const lastAttempt = release.youtubeMetadataUpdatedAt || release.metadataEnrichedAt;
  if (!lastAttempt) {
    return true;
  }

  return now.getTime() - lastAttempt.getTime() > DISCOVERY_RETRY_INTERVAL_MS;
}

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
