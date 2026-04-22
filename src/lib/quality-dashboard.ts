import { unstable_cache } from "next/cache";

import { ArtworkStatus, GenreStatus, LinkStatus, ReleaseType } from "@/generated/prisma/enums";
import { ensureDatabase } from "@/lib/database";
import { isSpecificGenreProfile } from "@/lib/genre-profile";
import { prisma } from "@/lib/prisma";
import {
  assessReleaseQuality,
  getEffectiveSummaryQualityScore,
  getReleaseQualityIssues,
  isWeakQualityRelease,
  type ReleaseQualityIssueCode,
} from "@/lib/release-quality";
import { resolveBestGenreProfile } from "@/lib/genre-resolution";
import { normalizeSearchText } from "@/lib/release-search";
import { buildSummaryAudit } from "@/lib/summary-quality";

const QUALITY_RETRY_QUEUE_STATE_KEY = "quality-retry-queue";
const GENRE_AUDIT_LOOKBACK_DAYS = 45;

type QualityReleaseRow = {
  id: string;
  slug: string;
  title: string;
  artistName: string | null;
  projectTitle: string | null;
  aiSummary: string | null;
  qualityScore: number;
  genreName: string | null;
  genreConfidence: number;
  summaryQualityScore: number;
  artworkStatus: ArtworkStatus;
  genreStatus: GenreStatus;
  linkStatus: LinkStatus;
  releaseType: ReleaseType;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  youtubeUrl: string | null;
  youtubeMusicUrl: string | null;
  bandcampUrl: string | null;
  officialWebsiteUrl: string | null;
  officialStoreUrl: string | null;
  releaseDate: Date | null;
  publishedAt: Date;
};

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
  weakIssueBreakdown: Array<{
    code: ReleaseQualityIssueCode;
    label: string;
    count: number;
  }>;
  genreAudit: {
    missing: number;
    generic: number;
    suspicious: number;
    artistSuggestions: Array<{
      artistName: string;
      count: number;
      suggestedGenre: string;
      exampleTitles: string[];
    }>;
    suspiciousCards: Array<{
      id: string;
      slug: string;
      title: string;
      artistName: string | null;
      projectTitle: string | null;
      currentGenre: string | null;
      suggestedGenre: string;
      publishedAt: Date;
    }>;
  };
  summaryAudit: {
    lowQuality: number;
    repetitive: number;
    summaryOnlyWeak: number;
    repeatedPatterns: Array<{
      patternLabel: string;
      count: number;
      examples: string[];
    }>;
    flaggedCards: Array<{
      id: string;
      slug: string;
      title: string;
      artistName: string | null;
      projectTitle: string | null;
      aiSummary: string | null;
      summaryQualityScore: number;
      patternLabel: string | null;
      publishedAt: Date;
    }>;
    repairCandidates: Array<{
      id: string;
      slug: string;
      title: string;
      artistName: string | null;
      projectTitle: string | null;
      aiSummary: string | null;
      summaryQualityScore: number;
      qualityScore: number;
      priorityScore: number;
      qualityIssues: string[];
      publishedAt: Date;
    }>;
  };
  recentWeakCards: Array<{
    id: string;
    slug: string;
    title: string;
    artistName: string | null;
    projectTitle: string | null;
    qualityScore: number;
    genreName: string | null;
    genreConfidence: number;
    summaryQualityScore: number;
    artworkStatus: ArtworkStatus;
    genreStatus: GenreStatus;
    linkStatus: LinkStatus;
    releaseDate: Date | null;
    publishedAt: Date;
    qualityIssues: string[];
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
      recentQualityRows,
      weakIssueRows,
      genreAuditRows,
      summaryAuditRows,
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
          publishedAt: {
            gte: new Date(Date.now() - GENRE_AUDIT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          id: true,
          slug: true,
          title: true,
          artistName: true,
          projectTitle: true,
          aiSummary: true,
          qualityScore: true,
          genreName: true,
          genreConfidence: true,
          summaryQualityScore: true,
          artworkStatus: true,
          genreStatus: true,
          linkStatus: true,
          releaseType: true,
          imageUrl: true,
          thumbnailUrl: true,
          youtubeUrl: true,
          youtubeMusicUrl: true,
          bandcampUrl: true,
          officialWebsiteUrl: true,
          officialStoreUrl: true,
          releaseDate: true,
          publishedAt: true,
        },
        orderBy: [{ publishedAt: "desc" }],
        take: 320,
      }),
      prisma.release.findMany({
        where: {
          publishedAt: {
            gte: new Date(Date.now() - GENRE_AUDIT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          artistName: true,
          projectTitle: true,
          title: true,
          aiSummary: true,
          releaseType: true,
          genreName: true,
          genreConfidence: true,
          imageUrl: true,
          thumbnailUrl: true,
          youtubeUrl: true,
          youtubeMusicUrl: true,
          bandcampUrl: true,
          officialWebsiteUrl: true,
          officialStoreUrl: true,
          releaseDate: true,
          publishedAt: true,
          summaryQualityScore: true,
        },
        orderBy: [{ publishedAt: "desc" }],
        take: 320,
      }),
      prisma.release.findMany({
        where: {
          publishedAt: {
            gte: new Date(Date.now() - GENRE_AUDIT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          id: true,
          slug: true,
          title: true,
          artistName: true,
          projectTitle: true,
          releaseType: true,
          genreName: true,
          summary: true,
          aiSummary: true,
          outletName: true,
          labelName: true,
          publishedAt: true,
        },
        orderBy: [{ publishedAt: "desc" }],
        take: 320,
      }),
      prisma.release.findMany({
        where: {
          publishedAt: {
            gte: new Date(Date.now() - GENRE_AUDIT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000),
          },
          aiSummary: {
            not: null,
          },
        },
        select: {
          id: true,
          slug: true,
          title: true,
          artistName: true,
          projectTitle: true,
          aiSummary: true,
          publishedAt: true,
        },
        orderBy: [{ publishedAt: "desc" }],
        take: 320,
      }),
    ]);

    const retryQueue = parseRetryQueueCount(retryQueueRow?.value || null);
    const genreAudit = buildGenreAudit(genreAuditRows);
    const summaryAudit = buildSummaryAudit(summaryAuditRows);
    const weakIssueBreakdown = buildWeakIssueBreakdown(weakIssueRows);
    const recentWeakCards = buildRecentWeakCards(recentQualityRows);
    const summaryRepairCandidates = buildSummaryRepairCandidates(recentQualityRows);

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
      weakIssueBreakdown,
      genreAudit,
      summaryAudit: {
        ...summaryAudit,
        summaryOnlyWeak: summaryRepairCandidates.filter((release) => release.qualityIssues.length === 1).length,
        repairCandidates: summaryRepairCandidates.slice(0, 12),
      },
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

function buildWeakIssueBreakdown(
  rows: Array<Parameters<typeof getReleaseQualityIssues>[0]>,
): QualityDashboardData["weakIssueBreakdown"] {
  const issueMap = new Map<ReleaseQualityIssueCode, { label: string; count: number }>();

  for (const row of rows) {
    for (const issue of getReleaseQualityIssues(row)) {
      const current = issueMap.get(issue.code) || { label: issue.label, count: 0 };
      current.count += 1;
      issueMap.set(issue.code, current);
    }
  }

  return [...issueMap.entries()]
    .map(([code, value]) => ({
      code,
      label: value.label,
      count: value.count,
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.label.localeCompare(right.label);
    });
}

function buildRecentWeakCards(
  rows: Array<QualityReleaseRow>,
): QualityDashboardData["recentWeakCards"] {
  return rows
    .filter((release) => isWeakQualityRelease(release))
    .map((release) => {
      const snapshot = assessReleaseQuality(release);

      return {
        id: release.id,
        slug: release.slug,
        title: release.title,
        artistName: release.artistName,
        projectTitle: release.projectTitle,
        qualityScore: release.qualityScore,
        genreName: release.genreName,
        genreConfidence: release.genreConfidence,
        summaryQualityScore: getEffectiveSummaryQualityScore(release),
        artworkStatus: snapshot.artworkStatus,
        genreStatus: snapshot.genreStatus,
        linkStatus: snapshot.linkStatus,
        releaseDate: release.releaseDate,
        publishedAt: release.publishedAt,
        qualityIssues: getReleaseQualityIssues(release).map((issue) => issue.label),
        priorityScore: snapshot.priorityScore,
      };
    })
    .sort((left, right) => {
      if (right.priorityScore !== left.priorityScore) {
        return right.priorityScore - left.priorityScore;
      }

      return right.publishedAt.getTime() - left.publishedAt.getTime();
    })
    .slice(0, 24)
    .map((release) => ({
      id: release.id,
      slug: release.slug,
      title: release.title,
      artistName: release.artistName,
      projectTitle: release.projectTitle,
      qualityScore: release.qualityScore,
      genreName: release.genreName,
      genreConfidence: release.genreConfidence,
      summaryQualityScore: release.summaryQualityScore,
      artworkStatus: release.artworkStatus,
      genreStatus: release.genreStatus,
      linkStatus: release.linkStatus,
      releaseDate: release.releaseDate,
      publishedAt: release.publishedAt,
      qualityIssues: release.qualityIssues,
    }));
}

function buildSummaryRepairCandidates(
  rows: Array<QualityReleaseRow>,
): QualityDashboardData["summaryAudit"]["repairCandidates"] {
  return rows
    .map((release) => {
      const summaryQualityScore = getEffectiveSummaryQualityScore(release);
      const snapshot = assessReleaseQuality(release);
      const qualityIssues = getReleaseQualityIssues(release).map((issue) => issue.label);

      return {
        id: release.id,
        slug: release.slug,
        title: release.title,
        artistName: release.artistName,
        projectTitle: release.projectTitle,
        aiSummary: release.aiSummary,
        summaryQualityScore,
        qualityScore: release.qualityScore,
        priorityScore: snapshot.priorityScore,
        qualityIssues,
        publishedAt: release.publishedAt,
      };
    })
    .filter((release) => release.summaryQualityScore < 72)
    .sort((left, right) => {
      if (right.priorityScore !== left.priorityScore) {
        return right.priorityScore - left.priorityScore;
      }

      return right.publishedAt.getTime() - left.publishedAt.getTime();
    });
}

function buildGenreAudit(
  rows: Array<{
    id: string;
    slug: string;
    title: string;
    artistName: string | null;
    projectTitle: string | null;
    releaseType: ReleaseType;
    genreName: string | null;
    summary: string | null;
    aiSummary: string | null;
    outletName: string | null;
    labelName: string | null;
    publishedAt: Date;
  }>,
) {
  const suspiciousCards: QualityDashboardData["genreAudit"]["suspiciousCards"] = [];
  const artistSuggestionMap = new Map<
    string,
    {
      artistName: string;
      count: number;
      suggestedGenre: string;
      exampleTitles: Set<string>;
    }
  >();

  let missing = 0;
  let generic = 0;
  let suspicious = 0;

  for (const row of rows) {
    const currentGenre = row.genreName?.trim() || null;
    const suggestedGenre = resolveBestGenreProfile({
      releaseType: row.releaseType,
      currentGenre,
      explicitGenres: [currentGenre],
      textSegments: [
        row.title,
        row.projectTitle,
        row.summary,
        row.aiSummary,
        row.outletName,
      ],
      artistName: row.artistName,
      projectTitle: row.projectTitle,
      title: row.title,
      labelName: row.labelName,
      limit: 3,
    });

    const currentKey = normalizeSearchText(currentGenre || "");
    const suggestedKey = normalizeSearchText(suggestedGenre || "");
    const isMissing = !currentGenre;
    const isGeneric = currentGenre !== null && isGenericGenreValue(currentGenre);
    const isSuspicious =
      Boolean(suggestedKey) &&
      ((isMissing || isGeneric) ||
        (Boolean(currentKey) && !areGenreProfilesEquivalent(currentGenre, suggestedGenre)));

    if (isMissing) {
      missing += 1;
    }

    if (isGeneric) {
      generic += 1;
    }

    if (!isSuspicious || !suggestedGenre) {
      continue;
    }

    suspicious += 1;

    if (suspiciousCards.length < 24) {
      suspiciousCards.push({
        id: row.id,
        slug: row.slug,
        title: row.title,
        artistName: row.artistName,
        projectTitle: row.projectTitle,
        currentGenre,
        suggestedGenre,
        publishedAt: row.publishedAt,
      });
    }

    const normalizedArtist = normalizeSearchText(row.artistName || "");
    if (!normalizedArtist) {
      continue;
    }

    const suggestionKey = `${normalizedArtist}::${suggestedKey}`;
    const existing =
      artistSuggestionMap.get(suggestionKey) || {
        artistName: row.artistName || "Unknown artist",
        count: 0,
        suggestedGenre,
        exampleTitles: new Set<string>(),
      };

    existing.count += 1;
    if (existing.exampleTitles.size < 3) {
      existing.exampleTitles.add(row.projectTitle || row.title);
    }
    artistSuggestionMap.set(suggestionKey, existing);
  }

  return {
    missing,
    generic,
    suspicious,
    artistSuggestions: [...artistSuggestionMap.values()]
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }

        return left.artistName.localeCompare(right.artistName);
      })
      .slice(0, 18)
      .map((entry) => ({
        artistName: entry.artistName,
        count: entry.count,
        suggestedGenre: entry.suggestedGenre,
        exampleTitles: [...entry.exampleTitles],
      })),
    suspiciousCards,
  };
}

function isGenericGenreValue(value: string) {
  const normalized = normalizeSearchText(value);

  if (!normalized) {
    return true;
  }

  if (!isSpecificGenreProfile(value)) {
    return true;
  }

  return new Set([
    "indie",
    "alternative",
    "indie alternative",
    "alternative indie",
    "indie rock",
    "alternative rock",
    "indie pop",
    "alternative pop",
    "rock",
    "pop",
    "electronic",
    "singer songwriter",
  ]).has(normalized);
}

function areGenreProfilesEquivalent(left: string | null, right: string | null) {
  const leftParts = normalizeGenreParts(left);
  const rightParts = normalizeGenreParts(right);

  if (leftParts.length === 0 || rightParts.length === 0) {
    return false;
  }

  if (leftParts.length !== rightParts.length) {
    return false;
  }

  return leftParts.every((part, index) => part === rightParts[index]);
}

function normalizeGenreParts(value: string | null) {
  return (value || "")
    .split("/")
    .map((part) => normalizeSearchText(part))
    .filter(Boolean)
    .sort();
}
