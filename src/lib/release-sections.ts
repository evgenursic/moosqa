import { ReleaseType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { ensureDatabase } from "@/lib/database";
import { dedupeReleasesForDisplay } from "@/lib/display-dedupe";
import { buildGenreProfile, isSpecificGenreProfile } from "@/lib/genre-profile";
import { getGenreOverride } from "@/lib/genre-overrides";
import { prisma } from "@/lib/prisma";

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
  labelName: string | null;
  genreName: string | null;
  aiSummary: string | null;
  releaseDate: Date | null;
  publishedAt: Date;
  scoreAverage: number;
  scoreCount: number;
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
  topRated: 8,
  topRatedCandidates: 24,
  topEngaged: 8,
  topEngagedCandidates: 96,
} as const;
const LATEST_POSTS_LOOKBACK_DAYS = 4;
const TOP_ENGAGED_LOOKBACK_DAYS = 60;

const ARCHIVE_PAGE_SIZE = 24;
const SECTION_CACHE_TTL_MS = 12_000;
const SEARCH_INDEX_CACHE_TTL_MS = 15_000;
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

export const releaseSectionDefinitions: Record<ReleaseSectionKey, ReleaseSectionDefinition> = {
  latest: {
    key: "latest",
    title: "Latest posts",
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
  labelName: true,
  genreName: true,
  aiSummary: true,
  releaseDate: true,
  publishedAt: true,
  scoreAverage: true,
  scoreCount: true,
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
  const latestCutoffDate = new Date(Date.now() - LATEST_POSTS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const [
    latestCandidates,
    topRatedCandidates,
    topEngagedByComments,
    topEngagedByScore,
    topEngagedByAwards,
  ] = await Promise.all([
    prisma.release.findMany({
      select: releaseListingSelect,
      where: {
        publishedAt: {
          gte: latestCutoffDate,
        },
      },
      orderBy: { publishedAt: "desc" },
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
  ]);

  return {
    latest: prepareDisplayReleases(latestCandidates),
    topRated: prepareDisplayReleases(topRatedCandidates).slice(0, HOMEPAGE_LIMITS.topRated),
    topEngaged: prepareDisplayReleases(
      mergeReleasePools(topEngagedByComments, topEngagedByScore, topEngagedByAwards).sort(
        sortByEngagement,
      ),
    ).slice(0, HOMEPAGE_LIMITS.topEngaged),
    albums: [],
    eps: [],
    live: [],
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

export async function getSectionArchivePage(section: ReleaseSectionKey, requestedPage = 1) {
  await ensureDatabase();

  const releases = await getSectionReleases(section);
  const total = releases.length;
  const pageCount = Math.max(1, Math.ceil(total / ARCHIVE_PAGE_SIZE));
  const page = clampPageNumber(requestedPage, pageCount);
  const start = (page - 1) * ARCHIVE_PAGE_SIZE;
  const end = start + ARCHIVE_PAGE_SIZE;

  return {
    ...releaseSectionDefinitions[section],
    page,
    pageCount,
    total,
    releases: releases.slice(start, end),
  };
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

  const releases = await getSectionReleasesUncached(section);
  sectionArchiveCache.set(section, {
    expiresAt: Date.now() + SECTION_CACHE_TTL_MS,
    data: releases,
  });

  return releases;
}

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

function refineDisplayGenre(release: ReleaseListingItem): ReleaseListingItem {
  if (release.genreName && isSpecificGenreProfile(release.genreName)) {
    return release;
  }

  const overrideGenre = getGenreOverride(release);
  const refinedGenre = buildGenreProfile({
    explicitGenres: [overrideGenre, release.genreName],
    text: [
      release.title,
      release.projectTitle,
      release.summary,
      release.aiSummary,
      release.outletName,
    ]
      .filter(Boolean)
      .join(". "),
    artistName: release.artistName,
    projectTitle: release.projectTitle,
    title: release.title,
    labelName: release.labelName,
    limit: 3,
  });

  if (overrideGenre) {
    return {
      ...release,
      genreName: overrideGenre,
    };
  }

  if (!refinedGenre || (!isSpecificGenreProfile(refinedGenre) && release.genreName)) {
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
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
