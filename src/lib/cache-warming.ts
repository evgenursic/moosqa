import { getSearchOverlayPayload } from "@/lib/search-overlay";
import {
  getPlatformArchivePage,
  getPublicAnalyticsInsights,
  getSceneArchivePage,
  getSignalArchivePage,
} from "@/lib/analytics";
import { slugifyGenre } from "@/lib/archive-links";
import { AnalyticsEventType } from "@/generated/prisma/enums";
import {
  getHomepageSectionsData,
  getSearchReleases,
  getSectionArchivePage,
  type ReleaseListingItem,
  type ReleaseSectionKey,
} from "@/lib/release-sections";
import { prisma } from "@/lib/prisma";
import { getReleaseBySlug } from "@/lib/sync-releases";
import { resolveSocialImageDataUrl } from "@/lib/social-image";
import { getSiteUrl } from "@/lib/site";

const CRITICAL_SECTIONS: ReleaseSectionKey[] = [
  "latest",
  "top-rated",
  "top-engaged",
  "albums",
  "eps",
  "live",
];

export async function warmCriticalCaches() {
  const homepage = await getHomepageSectionsData();
  const analyticsInsights = await getPublicAnalyticsInsights();
  const searchHotReleaseIds = await getTopSearchOpenedReleaseIds(3);
  const highlightedReleaseIds = [
    ...homepage.latest.slice(0, 8).map((release) => release.id),
    ...analyticsInsights.trendingNow.map((entry) => entry.release?.id).filter((value): value is string => Boolean(value)),
    ...analyticsInsights.platformHighlights.map((entry) => entry.entry?.release?.id).filter((value): value is string => Boolean(value)),
    ...analyticsInsights.platformLeaderboards.flatMap((item) =>
      item.entries.map((entry) => entry.release?.id).filter((value): value is string => Boolean(value)),
    ),
    ...analyticsInsights.sectionTrendLeaders.flatMap((item) =>
      item.entries.map((entry) => entry.release?.id).filter((value): value is string => Boolean(value)),
    ),
    ...searchHotReleaseIds,
  ];
  const trendingGenreArchives = analyticsInsights.trendingByGenre.slice(0, 4).map((item) =>
    getSectionArchivePage("top-engaged", 1, item.genre, "trending")
  );
  const trendingSectionArchives = analyticsInsights.sectionTrendLeaders.map((item) =>
    getSectionArchivePage(item.section, 1, null, "trending")
  );
  const sceneArchives = analyticsInsights.discoveryScenes.slice(0, 4).map((item) =>
    getSceneArchivePage(item.slug, 1)
  );
  const platformArchives = (["bandcamp", "youtube", "youtube-music"] as const).flatMap((platform) =>
    (["today", "7d", "30d"] as const).map((timeframe) => getPlatformArchivePage(platform, 1, timeframe))
  );
  const signalArchives = [
    getSignalArchivePage("opened", 1, "today"),
    getSignalArchivePage("opened", 1, "7d"),
    getSignalArchivePage("shared", 1, "7d"),
    getSignalArchivePage("shared", 1, "30d"),
    getSignalArchivePage("listened", 1, "7d"),
    getSignalArchivePage("listened", 1, "30d"),
    getSignalArchivePage("liked", 1, "7d"),
    getSignalArchivePage("disliked", 1, "7d"),
    getSignalArchivePage("liked", 1, "30d"),
    getSignalArchivePage("discussed", 1, "7d"),
    getSignalArchivePage("discussed", 1, "30d"),
    getSignalArchivePage("discussed", 1, "today"),
  ];
  const socialPreviewPaths = [
    "/signals/opened/opengraph-image",
    "/signals/shared/opengraph-image",
    "/signals/listened/opengraph-image",
    "/signals/liked/opengraph-image",
    "/signals/discussed/opengraph-image",
    ...analyticsInsights.trendingByGenre.slice(0, 4).map((item) => `/trending/${slugifyGenre(item.genre)}/opengraph-image`),
    ...analyticsInsights.discoveryScenes.slice(0, 4).map((item) => `/scene/${item.slug}/opengraph-image`),
    "/platform/bandcamp/opengraph-image",
    "/platform/youtube/opengraph-image",
    "/platform/youtube-music/opengraph-image",
  ];

  await Promise.all([
    getSearchOverlayPayload(),
    getSearchReleases(),
    ...CRITICAL_SECTIONS.map((section) => getSectionArchivePage(section, 1)),
    ...trendingGenreArchives,
    ...trendingSectionArchives,
    ...sceneArchives,
    ...platformArchives,
    ...signalArchives,
    ...[...new Set(highlightedReleaseIds)].map((releaseId) => warmReleaseCachesById(releaseId)),
    ...socialPreviewPaths.map((path) => warmInternalPreviewPath(path)),
  ]);
  await Promise.all(
    homepage.latest
      .slice(0, 10)
      .map((release) => release.imageUrl || release.thumbnailUrl)
      .filter((value): value is string => Boolean(value))
      .map((imageUrl) => resolveSocialImageDataUrl(imageUrl)),
  );

  return {
    warmedSections:
      CRITICAL_SECTIONS.length +
      trendingGenreArchives.length +
      trendingSectionArchives.length +
      sceneArchives.length +
      platformArchives.length +
      signalArchives.length,
    warmedReleases: [...new Set(highlightedReleaseIds)].length,
  };
}

export async function warmReleaseCachesById(releaseId: string) {
  const release = await prisma.release.findUnique({
    where: { id: releaseId },
    select: {
      slug: true,
    },
  });

  if (!release) {
    return { warmed: false };
  }

  await getReleaseBySlug(release.slug);

  return {
    warmed: true,
    slug: release.slug,
  };
}

export async function warmVisibleReleaseBatch(releases: ReleaseListingItem[]) {
  await Promise.all(releases.slice(0, 8).map((release) => getReleaseBySlug(release.slug)));
  return {
    warmed: Math.min(releases.length, 8),
  };
}

async function getTopSearchOpenedReleaseIds(limit: number) {
  const recentCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const groups = await prisma.analyticsEvent.groupBy({
    by: ["releaseId"],
    where: {
      action: AnalyticsEventType.OPEN,
      createdAt: {
        gte: recentCutoff,
      },
      releaseId: {
        not: null,
      },
      OR: [
        { sourcePath: { contains: "#explore" } },
        { sourcePath: { contains: "?q=" } },
      ],
    },
    _count: {
      _all: true,
    },
    orderBy: {
      _count: {
        releaseId: "desc",
      },
    },
    take: limit,
  });

  return groups
    .map((group) => group.releaseId)
    .filter((value): value is string => Boolean(value));
}

async function warmInternalPreviewPath(path: string) {
  try {
    await fetch(new URL(path, getSiteUrl()), {
      cache: "force-cache",
      headers: {
        "user-agent": "MooSQA/1.0 (+https://moosqa-ci4e.vercel.app)",
      },
    });
  } catch {
    // ignore preview warming failures
  }
}
