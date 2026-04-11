import { unstable_cache } from "next/cache";

import { ArtworkStatus, GenreStatus, LinkStatus, ReleaseType } from "@/generated/prisma/enums";
import { ensureDatabase } from "@/lib/database";
import { isSpecificGenreProfile } from "@/lib/genre-profile";
import { prisma } from "@/lib/prisma";
import { resolveBestGenreProfile } from "@/lib/genre-resolution";
import { normalizeSearchText } from "@/lib/release-search";

const QUALITY_RETRY_QUEUE_STATE_KEY = "quality-retry-queue";
const GENRE_AUDIT_LOOKBACK_DAYS = 45;

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
      genreAuditRows,
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
    ]);

    const retryQueue = parseRetryQueueCount(retryQueueRow?.value || null);
    const genreAudit = buildGenreAudit(genreAuditRows);

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
      genreAudit,
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
