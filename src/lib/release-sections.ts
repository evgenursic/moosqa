import { unstable_cache } from "next/cache";
import { ReleaseType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { ensureDatabase } from "@/lib/database";
import { dedupeReleasesForDisplay } from "@/lib/display-dedupe";
import { isSpecificGenreProfile } from "@/lib/genre-profile";
import { getGenreOverride } from "@/lib/genre-overrides";
import { prisma } from "@/lib/prisma";
import { resolveBestGenreProfile } from "@/lib/genre-resolution";
import { normalizeSearchText } from "@/lib/release-search";
import { computeTrendingScore } from "@/lib/trending-score";
import type { ArchiveViewMode } from "@/lib/archive-links";

export type ReleaseSectionKey =
  | "latest"
  | "top-rated"
  | "top-engaged"
  | "albums"
  | "eps"
  | "live";

export type ReleaseListingItem = {
  id: string;
  slug: string;
  title: string;
  artistName: string | null;
  projectTitle: string | null;
  releaseType: ReleaseType;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  summary: string | null;
  outletName: string | null;
  sourceUrl: string;
  youtubeUrl: string | null;
  youtubeMusicUrl: string | null;
  bandcampUrl: string | null;
  officialWebsiteUrl: string | null;
  officialStoreUrl: string | null;
  qualityScore: number;
  labelName: string | null;
  genreName: string | null;
  aiSummary: string | null;
  releaseDate: Date | null;
  publishedAt: Date;
  scoreAverage: number;
  scoreCount: number;
  openCount: number;
  listenClickCount: number;
  shareCount: number;
  positiveReactionCount: number;
  negativeReactionCount: number;
  score: number | null;
  commentCount: number | null;
  upvoteRatio: number | null;
  awardCount: number | null;
  crosspostCount: number | null;
};

type ReleaseSectionDefinition = {
  key: ReleaseSectionKey;
  title: string;
  homeId: string;
  description: string;
  readMoreLabel: string;
  emptyState: string;
};

const HOMEPAGE_LIMITS = {
  latest: 15,
  latestCandidates: 48,
  gridSection: 12,
  gridCandidates: 24,
  topRated: 8,
  topRatedCandidates: 24,
  topEngaged: 8,
  topEngagedCandidates: 96,
} as const;
const TOP_ENGAGED_LOOKBACK_DAYS = 60;

const ARCHIVE_PAGE_SIZE = 24;
const SECTION_CACHE_TTL_MS = 12_000;
const SEARCH_INDEX_CACHE_TTL_MS = 15_000;
const SEARCH_GENRE_FACET_LIMIT = 96;
const RELEASES_CACHE_REVALIDATE_SECONDS = 300;
const RELEASES_CACHE_TAG = "releases";
let homepageSectionsCache:
  | {
      expiresAt: number;
      data: Awaited<ReturnType<typeof getHomepageSectionsDataUncached>>;
    }
  | null = null;
let sectionArchiveCache = new Map<
  ReleaseSectionKey,
  {
    expiresAt: number;
    data: ReleaseListingItem[];
  }
>();
let searchIndexCache:
  | {
      expiresAt: number;
      data: ReleaseListingItem[];
    }
  | null = null;
let searchGenreFacetCache:
  | {
      expiresAt: number;
      data: string[];
    }
  | null = null;

export const releaseSectionDefinitions: Record<ReleaseSectionKey, ReleaseSectionDefinition> = {
  latest: {
    key: "latest",
    title: "Recent posts",
    homeId: "latest",
    description: "All recent singles, albums, EPs, and live performances pulled from r/indieheads in one feed.",
    readMoreLabel: "Read more recent posts",
    emptyState: "No recent posts are available yet.",
  },
  "top-rated": {
    key: "top-rated",
    title: "Top rated",
    homeId: "top-rated",
    description: "The highest-rated releases from the MooSQA community feed.",
    readMoreLabel: "Read more top rated releases",
    emptyState: "No rated releases are available yet.",
  },
  "top-engaged": {
    key: "top-engaged",
    title: "Top engaged on Indieheads",
    homeId: "top-engaged",
    description:
      "Releases ranked by Reddit score, comment activity, upvote approval, awards, crossposts, and recency.",
    readMoreLabel: "Read more top engaged releases",
    emptyState: "No high-engagement releases are available yet.",
  },
  albums: {
    key: "albums",
    title: "Albums",
    homeId: "albums",
    description: "Full-length releases gathered into one archive.",
    readMoreLabel: "Read more albums",
    emptyState: "No albums are available yet.",
  },
  eps: {
    key: "eps",
    title: "EPs",
    homeId: "eps",
    description: "Short-form releases and EP drops from the feed.",
    readMoreLabel: "Read more EPs",
    emptyState: "No EPs are available yet.",
  },
  live: {
    key: "live",
    title: "Live performances",
    homeId: "live",
    description: "Live sessions, in-studio performances, and filmed sets.",
    readMoreLabel: "Read more live performances",
    emptyState: "No live performances are available yet.",
  },
};

export function clearReleaseDataCaches() {
  homepageSectionsCache = null;
  sectionArchiveCache = new Map();
  searchIndexCache = null;
  searchGenreFacetCache = null;
}

const releaseListingSelect = {
  id: true,
  slug: true,
  title: true,
  artistName: true,
  projectTitle: true,
  releaseType: true,
  imageUrl: true,
  thumbnailUrl: true,
  summary: true,
  outletName: true,
  sourceUrl: true,
  youtubeUrl: true,
  youtubeMusicUrl: true,
  bandcampUrl: true,
  officialWebsiteUrl: true,
  officialStoreUrl: true,
  qualityScore: true,
  labelName: true,
  genreName: true,
  aiSummary: true,
  releaseDate: true,
  publishedAt: true,
  scoreAverage: true,
  scoreCount: true,
  openCount: true,
  listenClickCount: true,
  shareCount: true,
  positiveReactionCount: true,
  negativeReactionCount: true,
  score: true,
  commentCount: true,
  upvoteRatio: true,
  awardCount: true,
  crosspostCount: true,
} as const;

export async function getHomepageSectionsData() {
  const now = Date.now();
  if (homepageSectionsCache && homepageSectionsCache.expiresAt > now) {
    return homepageSectionsCache.data;
  }

  const data = await getHomepageSectionsDataUncached();
  homepageSectionsCache = {
    expiresAt: now + SECTION_CACHE_TTL_MS,
    data,
  };

  return data;
}

async function getHomepageSectionsDataUncached() {
  await ensureDatabase();

  const [
    latestCandidates,
    topRatedCandidates,
    topEngagedByComments,
    topEngagedByScore,
    topEngagedByAwards,
    albumCandidates,
    epCandidates,
    liveCandidates,
  ] = await Promise.all([
    prisma.release.findMany({
      select: releaseListingSelect,
      orderBy: { publishedAt: "desc" },
      take: HOMEPAGE_LIMITS.latestCandidates,
    }),
    prisma.release.findMany({
      select: releaseListingSelect,
      where: { scoreCount: { gt: 0 } },
      orderBy: [{ scoreAverage: "desc" }, { scoreCount: "desc" }, { publishedAt: "desc" }],
      take: HOMEPAGE_LIMITS.topRatedCandidates,
    }),
    prisma.release.findMany({
      select: releaseListingSelect,
      where: getTopEngagedWhere(),
      orderBy: [{ commentCount: "desc" }, { publishedAt: "desc" }],
      take: HOMEPAGE_LIMITS.topEngagedCandidates,
    }),
    prisma.release.findMany({
      select: releaseListingSelect,
      where: getTopEngagedWhere(),
      orderBy: [{ score: "desc" }, { publishedAt: "desc" }],
      take: HOMEPAGE_LIMITS.topEngagedCandidates,
    }),
    prisma.release.findMany({
      select: releaseListingSelect,
      where: getTopEngagedWhere(),
      orderBy: [{ awardCount: "desc" }, { crosspostCount: "desc" }, { publishedAt: "desc" }],
      take: Math.ceil(HOMEPAGE_LIMITS.topEngagedCandidates / 2),
    }),
    prisma.release.findMany({
      select: releaseListingSelect,
      where: { releaseType: ReleaseType.ALBUM },
      orderBy: { publishedAt: "desc" },
      take: HOMEPAGE_LIMITS.gridCandidates,
    }),
    prisma.release.findMany({
      select: releaseListingSelect,
      where: { releaseType: ReleaseType.EP },
      orderBy: { publishedAt: "desc" },
      take: HOMEPAGE_LIMITS.gridCandidates,
    }),
    prisma.release.findMany({
      select: releaseListingSelect,
      where: {
        releaseType: {
          in: [ReleaseType.PERFORMANCE, ReleaseType.LIVE_SESSION],
        },
      },
      orderBy: { publishedAt: "desc" },
      take: HOMEPAGE_LIMITS.gridCandidates,
    }),
  ]);

  return {
    latest: prepareDisplayReleases(latestCandidates).slice(0, HOMEPAGE_LIMITS.latest),
    topRated: prepareDisplayReleases(topRatedCandidates).slice(0, HOMEPAGE_LIMITS.topRated),
    topEngaged: prepareDisplayReleases(
      mergeReleasePools(topEngagedByComments, topEngagedByScore, topEngagedByAwards).sort(
        sortByEngagement,
      ),
    ).slice(0, HOMEPAGE_LIMITS.topEngaged),
    albums: prepareDisplayReleases(albumCandidates).slice(0, HOMEPAGE_LIMITS.gridSection),
    eps: prepareDisplayReleases(epCandidates).slice(0, HOMEPAGE_LIMITS.gridSection),
    live: prepareDisplayReleases(liveCandidates).slice(0, HOMEPAGE_LIMITS.gridSection),
  };
}

export async function getSearchReleases(options?: { useCache?: boolean; ttlMs?: number }) {
  await ensureDatabase();
  const useCache = options?.useCache ?? true;
  const ttlMs = options?.ttlMs ?? SEARCH_INDEX_CACHE_TTL_MS;

  if (useCache && searchIndexCache && searchIndexCache.expiresAt > Date.now()) {
    return searchIndexCache.data;
  }

  const releases = await prisma.release.findMany({
    select: releaseListingSelect,
    orderBy: { publishedAt: "desc" },
  });

  const preparedReleases = prepareDisplayReleases(releases);

  if (useCache) {
    searchIndexCache = {
      expiresAt: Date.now() + ttlMs,
      data: preparedReleases,
    };
  }

  return preparedReleases;
}

export async function getSearchGenreFacets(options?: { useCache?: boolean; ttlMs?: number }) {
  await ensureDatabase();
  const useCache = options?.useCache ?? true;
  const ttlMs = options?.ttlMs ?? SEARCH_INDEX_CACHE_TTL_MS;

  if (useCache && searchGenreFacetCache && searchGenreFacetCache.expiresAt > Date.now()) {
    return searchGenreFacetCache.data;
  }

  const recentCutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const releases = await prisma.release.findMany({
    where: {
      publishedAt: {
        gte: recentCutoff,
      },
    },
    select: {
      title: true,
      artistName: true,
      projectTitle: true,
      releaseType: true,
      genreName: true,
      summary: true,
      aiSummary: true,
      labelName: true,
      publishedAt: true,
      qualityScore: true,
    },
    orderBy: [{ publishedAt: "desc" }],
    take: 500,
  });

  const genreMap = new Map<
    string,
    {
      label: string;
      count: number;
      latestPublishedAt: number;
      bestQualityScore: number;
    }
  >();

  for (const release of releases) {
    const genreName = resolveBestGenreProfile({
      releaseType: release.releaseType,
      currentGenre: release.genreName,
      explicitGenres: [release.genreName],
      textSegments: [
        release.title,
        release.projectTitle,
        release.summary,
        release.aiSummary,
      ],
      artistName: release.artistName,
      projectTitle: release.projectTitle,
      title: release.title,
      labelName: release.labelName,
      limit: 3,
    })?.trim();
    if (!genreName || !isSpecificGenreProfile(genreName)) {
      continue;
    }

    const key = genreName.toLowerCase();
    const existing = genreMap.get(key);
    if (existing) {
      existing.count += 1;
      existing.latestPublishedAt = Math.max(existing.latestPublishedAt, release.publishedAt.getTime());
      existing.bestQualityScore = Math.max(existing.bestQualityScore, release.qualityScore);
      continue;
    }

    genreMap.set(key, {
      label: genreName,
      count: 1,
      latestPublishedAt: release.publishedAt.getTime(),
      bestQualityScore: release.qualityScore,
    });
  }

  const genres = [...genreMap.values()]
    .sort((left, right) => {
      const countDelta = right.count - left.count;
      if (countDelta !== 0) {
        return countDelta;
      }

      const qualityDelta = right.bestQualityScore - left.bestQualityScore;
      if (qualityDelta !== 0) {
        return qualityDelta;
      }

      return right.latestPublishedAt - left.latestPublishedAt;
    })
    .slice(0, SEARCH_GENRE_FACET_LIMIT)
    .map((entry) => entry.label);

  if (useCache) {
    searchGenreFacetCache = {
      expiresAt: Date.now() + ttlMs,
      data: genres,
    };
  }

  return genres;
}

export async function getSectionArchivePage(
  section: ReleaseSectionKey,
  requestedPage = 1,
  requestedGenre?: string | null,
  requestedView: ArchiveViewMode = "latest",
) {
  await ensureDatabase();

  const releases = await getSectionReleases(section);
  const genres = buildSectionGenreFacets(releases);
  const matchedGenre = matchRequestedGenre(requestedGenre || null, genres);
  const filteredBaseReleases = matchedGenre
    ? releases.filter((release) => releaseMatchesGenre(release, matchedGenre))
    : releases;
  const filteredReleases =
    requestedView === "trending"
      ? [...filteredBaseReleases].sort((left, right) => {
          const trendingDelta = computeTrendingScore(right) - computeTrendingScore(left);
          if (trendingDelta !== 0) {
            return trendingDelta;
          }

          return right.publishedAt.getTime() - left.publishedAt.getTime();
        })
      : filteredBaseReleases;
  const total = filteredReleases.length;
  const pageCount = Math.max(1, Math.ceil(total / ARCHIVE_PAGE_SIZE));
  const page = clampPageNumber(requestedPage, pageCount);
  const start = (page - 1) * ARCHIVE_PAGE_SIZE;
  const end = start + ARCHIVE_PAGE_SIZE;

  return {
    ...releaseSectionDefinitions[section],
    archiveMode: requestedView,
    title: requestedView === "trending"
      ? `${releaseSectionDefinitions[section].title} trending`
      : releaseSectionDefinitions[section].title,
    description: buildArchiveDescription(section, requestedView, matchedGenre),
    genres,
    overallTotal: releases.length,
    page,
    pageCount,
    total,
    selectedGenre: matchedGenre,
    releases: filteredReleases.slice(start, end),
  };
}

export async function getSectionArchivePageLightweight(
  section: ReleaseSectionKey,
  requestedPage = 1,
  requestedGenre?: string | null,
  requestedView: ArchiveViewMode = "latest",
) {
  await ensureDatabase();

  const matchedGenre = requestedGenre?.trim() || null;
  const overscanTake = Math.max(ARCHIVE_PAGE_SIZE * 4, requestedPage * ARCHIVE_PAGE_SIZE * 3);
  const where = buildLightweightArchiveWhere(section, matchedGenre);
  const orderBy = getLightweightArchiveOrderBy(section, requestedView);

  const [total, releases] = await Promise.all([
    prisma.release.count({ where }),
    prisma.release.findMany({
      where,
      select: releaseListingSelect,
      orderBy,
      take: overscanTake,
    }),
  ]);

  const prepared = prepareDisplayReleases(releases);
  const filteredReleases =
    matchedGenre
      ? prepared.filter((release) => releaseMatchesGenre(release, matchedGenre))
      : prepared;
  const pageCount = Math.max(1, Math.ceil(total / ARCHIVE_PAGE_SIZE));
  const page = clampPageNumber(requestedPage, pageCount);
  const start = (page - 1) * ARCHIVE_PAGE_SIZE;
  const end = start + ARCHIVE_PAGE_SIZE;
  const genres = buildSectionGenreFacets(prepared).slice(0, 24);

  return {
    ...releaseSectionDefinitions[section],
    archiveMode: requestedView,
    title:
      requestedView === "trending"
        ? `${releaseSectionDefinitions[section].title} trending`
        : releaseSectionDefinitions[section].title,
    description: buildArchiveDescription(section, requestedView, matchedGenre),
    genres,
    overallTotal: total,
    page,
    pageCount,
    total,
    selectedGenre: matchedGenre,
    releases: filteredReleases.slice(start, end),
    lightweight: true,
  };
}

export async function getSectionReleasesForInsights(section: ReleaseSectionKey) {
  await ensureDatabase();
  return getSectionReleases(section);
}

export async function getReleaseListingItemsByIds(releaseIds: string[]) {
  await ensureDatabase();

  const uniqueIds = [...new Set(releaseIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return [];
  }

  const releases = await prisma.release.findMany({
    where: {
      id: {
        in: uniqueIds,
      },
    },
    select: releaseListingSelect,
  });

  return prepareDisplayReleases(releases);
}

export function isReleaseSectionKey(value: string): value is ReleaseSectionKey {
  return value in releaseSectionDefinitions;
}

function clampPageNumber(value: number, pageCount: number) {
  if (!Number.isFinite(value) || value < 1) {
    return 1;
  }

  if (value > pageCount) {
    return pageCount;
  }

  return Math.floor(value);
}

async function getSectionReleases(section: ReleaseSectionKey) {
  const cachedSection = sectionArchiveCache.get(section);
  if (cachedSection && cachedSection.expiresAt > Date.now()) {
    return cachedSection.data;
  }

  const releases = await getCachedSectionReleases(section);
  sectionArchiveCache.set(section, {
    expiresAt: Date.now() + SECTION_CACHE_TTL_MS,
    data: releases,
  });

  return releases;
}

const getCachedSectionReleases = unstable_cache(
  async (section: ReleaseSectionKey) => getSectionReleasesUncached(section),
  ["release-section-list"],
  {
    revalidate: RELEASES_CACHE_REVALIDATE_SECONDS,
    tags: [RELEASES_CACHE_TAG, "release-sections"],
  },
);

async function getSectionReleasesUncached(section: ReleaseSectionKey) {
  if (section === "latest") {
    const releases = await prisma.release.findMany({
      select: releaseListingSelect,
      orderBy: { publishedAt: "desc" },
    });
    return prepareDisplayReleases(releases);
  }

  if (section === "top-rated") {
    const releases = await prisma.release.findMany({
      select: releaseListingSelect,
      where: { scoreCount: { gt: 0 } },
      orderBy: [{ scoreAverage: "desc" }, { scoreCount: "desc" }, { publishedAt: "desc" }],
    });
    return prepareDisplayReleases(releases);
  }

  if (section === "top-engaged") {
    const releases = await prisma.release.findMany({
      select: releaseListingSelect,
      where: getTopEngagedWhere(),
      orderBy: [{ commentCount: "desc" }, { score: "desc" }, { publishedAt: "desc" }],
    });
    return prepareDisplayReleases(releases.sort(sortByEngagement));
  }

  if (section === "albums") {
    const releases = await prisma.release.findMany({
      select: releaseListingSelect,
      where: { releaseType: ReleaseType.ALBUM },
      orderBy: { publishedAt: "desc" },
    });
    return prepareDisplayReleases(releases);
  }

  if (section === "eps") {
    const releases = await prisma.release.findMany({
      select: releaseListingSelect,
      where: { releaseType: ReleaseType.EP },
      orderBy: { publishedAt: "desc" },
    });
    return prepareDisplayReleases(releases);
  }

  const releases = await prisma.release.findMany({
    select: releaseListingSelect,
    where: {
      releaseType: {
        in: [ReleaseType.PERFORMANCE, ReleaseType.LIVE_SESSION],
      },
    },
    orderBy: { publishedAt: "desc" },
  });

  return prepareDisplayReleases(releases);
}

function prepareDisplayReleases(releases: ReleaseListingItem[]) {
  return dedupeReleasesForDisplay(releases).map(refineDisplayGenre);
}

function buildSectionGenreFacets(releases: ReleaseListingItem[]) {
  const genreMap = new Map<
    string,
    {
      label: string;
      count: number;
      latestPublishedAt: number;
      bestQualityScore: number;
    }
  >();

  for (const release of releases) {
    const genreName = release.genreName?.trim();
    if (!genreName || !isSpecificGenreProfile(genreName)) {
      continue;
    }

    const key = normalizeSearchText(genreName);
    if (!key) {
      continue;
    }

    const existing = genreMap.get(key);
    if (existing) {
      existing.count += 1;
      existing.latestPublishedAt = Math.max(existing.latestPublishedAt, release.publishedAt.getTime());
      existing.bestQualityScore = Math.max(existing.bestQualityScore, release.qualityScore);
      continue;
    }

    genreMap.set(key, {
      label: genreName,
      count: 1,
      latestPublishedAt: release.publishedAt.getTime(),
      bestQualityScore: release.qualityScore,
    });
  }

  return [...genreMap.values()]
    .sort((left, right) => {
      const countDelta = right.count - left.count;
      if (countDelta !== 0) {
        return countDelta;
      }

      const qualityDelta = right.bestQualityScore - left.bestQualityScore;
      if (qualityDelta !== 0) {
        return qualityDelta;
      }

      return right.latestPublishedAt - left.latestPublishedAt;
    })
    .slice(0, 48)
    .map((entry) => entry.label);
}

function matchRequestedGenre(requestedGenre: string | null, genres: string[]) {
  const normalizedRequestedGenre = normalizeSearchText(requestedGenre || "");
  if (!normalizedRequestedGenre) {
    return null;
  }

  const exactMatch = genres.find((genre) => normalizeSearchText(genre) === normalizedRequestedGenre);
  if (exactMatch) {
    return exactMatch;
  }

  return (
    genres.find((genre) => {
      const normalizedGenre = normalizeSearchText(genre);
      return normalizedGenre.includes(normalizedRequestedGenre) || normalizedRequestedGenre.includes(normalizedGenre);
    }) || null
  );
}

function releaseMatchesGenre(release: ReleaseListingItem, selectedGenre: string) {
  const normalizedReleaseGenre = normalizeSearchText(release.genreName || "");
  const normalizedSelectedGenre = normalizeSearchText(selectedGenre);

  if (!normalizedReleaseGenre || !normalizedSelectedGenre) {
    return false;
  }

  return (
    normalizedReleaseGenre === normalizedSelectedGenre ||
    normalizedReleaseGenre.includes(normalizedSelectedGenre)
  );
}

function refineDisplayGenre(release: ReleaseListingItem): ReleaseListingItem {
  const refinedGenre = resolveBestGenreProfile({
    releaseType: release.releaseType,
    currentGenre: release.genreName,
    explicitGenres: [getGenreOverride(release), release.genreName],
    textSegments: [
      release.title,
      release.projectTitle,
      release.summary,
      release.aiSummary,
      release.outletName,
      release.labelName,
      release.sourceUrl,
    ],
    artistName: release.artistName,
    projectTitle: release.projectTitle,
    title: release.title,
    labelName: release.labelName,
    limit: 3,
  });

  if (!refinedGenre) {
    return release;
  }

  return {
    ...release,
    genreName: refinedGenre,
  };
}

function sortByEngagement(left: ReleaseListingItem, right: ReleaseListingItem) {
  const engagementDelta = getEngagementScore(right) - getEngagementScore(left);
  if (engagementDelta !== 0) {
    return engagementDelta;
  }

  const scoreDelta = (right.scoreAverage || 0) - (left.scoreAverage || 0);
  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  return right.publishedAt.getTime() - left.publishedAt.getTime();
}

function getEngagementScore(
  release: Pick<
    ReleaseListingItem,
    | "publishedAt"
    | "commentCount"
    | "score"
    | "upvoteRatio"
    | "awardCount"
    | "crosspostCount"
    | "scoreCount"
    | "scoreAverage"
  >,
) {
  const commentCount = Math.max(release.commentCount ?? 0, 0);
  const redditScore = Math.max(release.score ?? 0, 0);
  const upvoteRatio = clamp(release.upvoteRatio ?? 0.5, 0, 1);
  const awardCount = Math.max(release.awardCount ?? 0, 0);
  const crosspostCount = Math.max(release.crosspostCount ?? 0, 0);
  const communityVotes = Math.max(release.scoreCount ?? 0, 0);
  const communityAverage = Math.max(release.scoreAverage ?? 0, 0);
  const ageHours = Math.max(
    1,
    (Date.now() - release.publishedAt.getTime()) / (1000 * 60 * 60),
  );
  const scoreVelocity = redditScore / Math.pow(ageHours + 2, 0.72);
  const commentVelocity = commentCount / Math.pow(ageHours + 2, 0.62);
  const scoreReach = Math.log1p(redditScore) * 7.5;
  const discussionReach = Math.log1p(commentCount) * 10.5;
  const discussionDepth =
    commentCount > 0
      ? Math.min(14, (commentCount / Math.max(redditScore, 8)) * 18)
      : 0;
  const approvalWeight = typeof release.upvoteRatio === "number" ? (upvoteRatio - 0.7) * 24 : 0;
  const awardsWeight = Math.log1p(awardCount) * 6.5;
  const crosspostWeight = Math.log1p(crosspostCount) * 5;
  const communityWeight =
    (communityVotes > 0 ? Math.log1p(communityVotes) * 3.4 : 0) +
    (communityAverage > 0 ? communityAverage / 20 : 0);
  const sustainedAttentionBonus =
    ageHours >= 12 && ageHours <= 168 && redditScore >= 25 && commentCount >= 6 ? 4 : 0;

  return (
    scoreVelocity * 1.15 +
    commentVelocity * 2.8 +
    scoreReach +
    discussionReach +
    discussionDepth +
    approvalWeight +
    awardsWeight +
    crosspostWeight +
    communityWeight +
    sustainedAttentionBonus
  );
}

function getTopEngagedWhere(): Prisma.ReleaseWhereInput {
  const cutoffDate = new Date(Date.now() - TOP_ENGAGED_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  return {
    publishedAt: {
      gte: cutoffDate,
    },
    OR: [
      { commentCount: { gte: 4 } },
      { score: { gte: 18 } },
      {
        AND: [{ score: { gte: 10 } }, { commentCount: { gte: 3 } }],
      },
      { awardCount: { gt: 0 } },
      { crosspostCount: { gt: 0 } },
      { scoreCount: { gt: 0 } },
    ],
  };
}

function buildLightweightArchiveWhere(
  section: ReleaseSectionKey,
  requestedGenre: string | null,
): Prisma.ReleaseWhereInput {
  const genreWhere =
    requestedGenre && normalizeSearchText(requestedGenre)
      ? {
          genreName: {
            contains: requestedGenre,
            mode: "insensitive" as const,
          },
        }
      : {};

  if (section === "top-rated") {
    return {
      scoreCount: { gt: 0 },
      ...genreWhere,
    };
  }

  if (section === "top-engaged") {
    return {
      ...getTopEngagedWhere(),
      ...genreWhere,
    };
  }

  if (section === "albums") {
    return {
      releaseType: ReleaseType.ALBUM,
      ...genreWhere,
    };
  }

  if (section === "eps") {
    return {
      releaseType: ReleaseType.EP,
      ...genreWhere,
    };
  }

  if (section === "live") {
    return {
      releaseType: {
        in: [ReleaseType.PERFORMANCE, ReleaseType.LIVE_SESSION],
      },
      ...genreWhere,
    };
  }

  return genreWhere;
}

function getLightweightArchiveOrderBy(
  section: ReleaseSectionKey,
  requestedView: ArchiveViewMode,
): Prisma.ReleaseOrderByWithRelationInput[] {
  if (requestedView === "trending" || section === "top-engaged") {
    return [{ commentCount: "desc" }, { score: "desc" }, { publishedAt: "desc" }];
  }

  if (section === "top-rated") {
    return [{ scoreAverage: "desc" }, { scoreCount: "desc" }, { publishedAt: "desc" }];
  }

  return [{ publishedAt: "desc" }];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildArchiveDescription(
  section: ReleaseSectionKey,
  view: ArchiveViewMode,
  genre: string | null,
) {
  const baseDescription = releaseSectionDefinitions[section].description;
  if (view !== "trending" && !genre) {
    return baseDescription;
  }

  const parts = [baseDescription];
  if (view === "trending") {
    parts.push("Sorted by current audience momentum instead of standard chronology.");
  }
  if (genre) {
    parts.push(`Filtered to ${genre}.`);
  }

  return parts.join(" ");
}

function mergeReleasePools(...pools: ReleaseListingItem[][]) {
  const byId = new Map<string, ReleaseListingItem>();

  for (const pool of pools) {
    for (const release of pool) {
      if (!byId.has(release.id)) {
        byId.set(release.id, release);
      }
    }
  }

  return [...byId.values()];
}
