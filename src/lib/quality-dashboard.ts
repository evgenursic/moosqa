import { unstable_cache } from "next/cache";

import { ArtworkStatus, GenreStatus, LinkStatus } from "@/generated/prisma/enums";
import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";

const QUALITY_RETRY_QUEUE_STATE_KEY = "quality-retry-queue";

export type QualityDashboardData = {
  totals: {
    releases: number;
    missingReleaseDate: number;
    lowQuality: number;
    retryQueue: number;
  };
  artwork: Record<ArtworkStatus, number>;
  genre: Record<GenreStatus, number>;
  links: Record<LinkStatus, number>;
  recentWeakCards: Array<{
    id: string;
    slug: string;
    title: string;
    artistName: string | null;
    projectTitle: string | null;
    qualityScore: number;
    artworkStatus: ArtworkStatus;
    genreStatus: GenreStatus;
    linkStatus: LinkStatus;
    releaseDate: Date | null;
    publishedAt: Date;
  }>;
};

export async function getQualityDashboardData() {
  await ensureDatabase();
  return getCachedQualityDashboardData();
}

const getCachedQualityDashboardData = unstable_cache(
  async (): Promise<QualityDashboardData> => {
    const [
      totalReleases,
      missingReleaseDate,
      lowQuality,
      artworkGroups,
      genreGroups,
      linkGroups,
      retryQueueRow,
      recentWeakCards,
    ] = await Promise.all([
      prisma.release.count(),
      prisma.release.count({
        where: {
          releaseDate: null,
        },
      }),
      prisma.release.count({
        where: {
          qualityScore: {
            lt: 70,
          },
        },
      }),
      prisma.release.groupBy({
        by: ["artworkStatus"],
        _count: {
          _all: true,
        },
      }),
      prisma.release.groupBy({
        by: ["genreStatus"],
        _count: {
          _all: true,
        },
      }),
      prisma.release.groupBy({
        by: ["linkStatus"],
        _count: {
          _all: true,
        },
      }),
      prisma.appState.findUnique({
        where: { key: QUALITY_RETRY_QUEUE_STATE_KEY },
        select: { value: true },
      }),
      prisma.release.findMany({
        where: {
          OR: [
            { artworkStatus: { not: ArtworkStatus.STRONG } },
            { genreStatus: { not: GenreStatus.STRONG } },
            { linkStatus: { not: LinkStatus.STRONG } },
            { releaseDate: null },
          ],
        },
        select: {
          id: true,
          slug: true,
          title: true,
          artistName: true,
          projectTitle: true,
          qualityScore: true,
          artworkStatus: true,
          genreStatus: true,
          linkStatus: true,
          releaseDate: true,
          publishedAt: true,
        },
        orderBy: [{ qualityScore: "asc" }, { publishedAt: "desc" }],
        take: 24,
      }),
    ]);

    const retryQueue = parseRetryQueueCount(retryQueueRow?.value || null);

    return {
      totals: {
        releases: totalReleases,
        missingReleaseDate,
        lowQuality,
        retryQueue,
      },
      artwork: createStatusCountMap(
        Object.values(ArtworkStatus),
        artworkGroups,
        (group) => group.artworkStatus,
      ),
      genre: createStatusCountMap(
        Object.values(GenreStatus),
        genreGroups,
        (group) => group.genreStatus,
      ),
      links: createStatusCountMap(
        Object.values(LinkStatus),
        linkGroups,
        (group) => group.linkStatus,
      ),
      recentWeakCards,
    };
  },
  ["quality-dashboard"],
  {
    revalidate: 60,
    tags: ["releases", "quality-dashboard"],
  },
);

function createStatusCountMap<TStatus extends string, TGroup extends { _count: { _all: number } }>(
  statuses: TStatus[],
  groups: TGroup[],
  getStatus: (group: TGroup) => TStatus,
) {
  const result = statuses.reduce(
    (accumulator, status) => {
      accumulator[status] = 0;
      return accumulator;
    },
    {} as Record<TStatus, number>,
  );

  for (const group of groups) {
    const statusValue = getStatus(group);
    result[statusValue] = group._count._all;
  }

  return result;
}

function parseRetryQueueCount(rawValue: string | null) {
  if (!rawValue) {
    return 0;
  }

  try {
    const parsed = JSON.parse(rawValue) as { releaseIds?: string[] };
    return Array.isArray(parsed.releaseIds) ? parsed.releaseIds.length : 0;
  } catch {
    return 0;
  }
}
