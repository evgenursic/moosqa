import { getSearchOverlayPayload } from "@/lib/search-overlay";
import { getPublicAnalyticsInsights } from "@/lib/analytics";
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

  await Promise.all([
    getSearchOverlayPayload(),
    getSearchReleases(),
    ...CRITICAL_SECTIONS.map((section) => getSectionArchivePage(section, 1)),
    ...trendingGenreArchives,
    ...trendingSectionArchives,
    ...[...new Set(highlightedReleaseIds)].map((releaseId) => warmReleaseCachesById(releaseId)),
  ]);

  return {
    warmedSections: CRITICAL_SECTIONS.length + trendingGenreArchives.length + trendingSectionArchives.length,
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
