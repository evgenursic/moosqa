import { unstable_cache } from "next/cache";

import { FollowTargetType, NotificationJobStatus, ReleaseExternalSourceType, UserRole } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { ensureDatabase } from "@/lib/database";
import { applyReleaseEditorialFields, buildVisibleReleaseWhere } from "@/lib/editorial";
import { prisma } from "@/lib/prisma";
import { getQualityDashboardData } from "@/lib/quality-dashboard";
import { getReleaseListingItemsByIds } from "@/lib/release-sections";

type CountRow = {
  count: bigint;
};

type GenrePerformanceRow = {
  genre: string;
  opens: bigint;
  count: bigint;
};

type SaveConversionByTypeRow = {
  releaseType: string;
  saves: bigint;
  opens: bigint;
};

type SourcePerformanceRow = {
  source: string;
  opens: bigint;
  listenClicks: bigint;
  shares: bigint;
  saves: bigint;
};

type EditorialPerformanceRow = {
  status: string;
  releaseCount: bigint;
  opens: bigint;
  saves: bigint;
};

type FollowPathwayRow = {
  pathway: string;
  count: bigint;
};

type DailyTrendRow = {
  dateKey: string;
  opens: bigint;
  saves: bigint;
  follows: bigint;
  notificationQueued: bigint;
  notificationSent: bigint;
  notificationFailed: bigint;
  notificationSkipped: bigint;
};

type PublicMetricCoverageRow = {
  visibleReleases: bigint;
  youtubeVisible: bigint;
  youtubeMissingViews: bigint;
  recentYoutubeMissingViews: bigint;
  redditUpvoteVisible: bigint;
  redditCommentVisible: bigint;
  bandcampSupporterVisible: bigint;
  bandcampFollowerVisible: bigint;
  bandcampMetricVisible: bigint;
  youtubeMetadataStale: bigint;
  missingRedditScoreForRedditSource: bigint;
  noPublicMetric: bigint;
};

type SearchReleaseRow = {
  id: string;
  slug: string;
  title: string;
  artistName: string | null;
  projectTitle: string | null;
  labelName: string | null;
  genreName: string | null;
  genreOverride: string | null;
  summary: string | null;
  summaryOverride: string | null;
  imageUrl: string | null;
  imageUrlOverride: string | null;
  sourceUrl: string;
  sourceUrlOverride: string | null;
  youtubeUrl: string | null;
  youtubeMusicUrl: string | null;
  youtubeViewCount: number | null;
  youtubePublishedAt: Date | null;
  bandcampUrl: string | null;
  bandcampSupporterCount: number | null;
  bandcampFollowerCount: number | null;
  bandcampMetadataUpdatedAt: Date | null;
  officialWebsiteUrl: string | null;
  officialStoreUrl: string | null;
  releaseType: string;
  publishedAt: Date;
  qualityScore: number;
  isHidden: boolean;
  hiddenReason: string | null;
  isFeatured: boolean;
  editorialRank: number;
  editorialNotes: string | null;
  featuredAt: Date | null;
  editorialUpdatedAt: Date | null;
  externalSources: Array<{
    id: string;
    sourceName: string;
    sourceUrl: string;
    title: string;
    summary: string | null;
    sourceType: ReleaseExternalSourceType;
    publishedAt: Date | null;
    isVisible: boolean;
    updatedAt: Date;
  }>;
};

type RoleRosterRow = {
  id: string;
  email: string | null;
  displayName: string | null;
  role: string;
  createdAt: Date;
};

const ADMIN_SEARCH_LIMIT = 18;

export async function getAdminDashboardData(query: string) {
  await ensureDatabase();
  const normalizedQuery = query.trim();

  const [
    quality,
    productAnalytics,
    collections,
    featuredReleases,
    searchResults,
    recentAudits,
    roleRoster,
    recentRoleAssignments,
  ] = await Promise.all([
    getQualityDashboardData(),
    getProductAnalyticsData(),
    getEditorialCollections(),
    getFeaturedReleaseRows(),
    normalizedQuery ? searchAdminReleases(normalizedQuery) : Promise.resolve([]),
    getRecentEditorialAudits(),
    getRoleRoster(),
    getRecentRoleAssignments(),
  ]);

  return {
    quality,
    productAnalytics,
    collections,
    featuredReleases,
    searchResults,
    recentAudits,
    roleRoster,
    recentRoleAssignments,
  };
}

const getProductAnalyticsData = unstable_cache(
  async () => {
    const [
      totalUsers,
      totalSaves,
      totalFollows,
      usersWithSaves,
      usersWithFollows,
      totalOpens,
      notificationPreferenceUsers,
      notificationEligibleRows,
      notificationJobGroups,
      topSavedReleaseGroups,
      topFollowArtistGroups,
      topFollowLabelGroups,
      genrePerformanceRows,
      saveConversionByTypeRows,
      sourcePerformanceRows,
      editorialPerformanceRows,
      followPathwayRows,
      dailyTrendRows,
      publicMetricCoverageRows,
    ] = await Promise.all([
      prisma.userProfile.count(),
      prisma.userSavedRelease.count(),
      prisma.userFollow.count(),
      prisma.userSavedRelease.findMany({
        distinct: ["userId"],
        select: { userId: true },
      }),
      prisma.userFollow.findMany({
        distinct: ["userId"],
        select: { userId: true },
      }),
      prisma.analyticsEvent.count({
        where: {
          action: "OPEN",
        },
      }),
      prisma.userPreference.count({
        where: {
          emailNotifications: true,
        },
      }),
      prisma.$queryRaw<CountRow[]>(Prisma.sql`
        select count(distinct up."userId") as count
        from "UserPreference" up
        join "UserProfile" profile on profile."id" = up."userId"
        left join "UserFollow" uf on uf."userId" = up."userId"
        left join "UserSavedRelease" usr on usr."userId" = up."userId"
        left join "Release" r on r."id" = usr."releaseId"
        where up."emailNotifications" = true
          and (up."dailyDigest" = true or up."weeklyDigest" = true)
          and profile."email" is not null
          and (
            uf."id" is not null
            or r."genreName" is not null
          )
      `),
      prisma.notificationJob.groupBy({
        by: ["status"],
        _count: {
          _all: true,
        },
      }),
      prisma.userSavedRelease.groupBy({
        by: ["releaseId"],
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
      prisma.userFollow.groupBy({
        by: ["targetValue"],
        where: {
          targetType: FollowTargetType.ARTIST,
        },
        _count: {
          _all: true,
        },
        orderBy: {
          _count: {
            targetValue: "desc",
          },
        },
        take: 8,
      }),
      prisma.userFollow.groupBy({
        by: ["targetValue"],
        where: {
          targetType: FollowTargetType.LABEL,
        },
        _count: {
          _all: true,
        },
        orderBy: {
          _count: {
            targetValue: "desc",
          },
        },
        take: 8,
      }),
      prisma.$queryRaw<GenrePerformanceRow[]>(Prisma.sql`
        with save_counts as (
          select usr."releaseId", count(*)::bigint as saves
          from "UserSavedRelease" usr
          group by usr."releaseId"
        )
        select
          coalesce(nullif(trim(coalesce(r."genreOverride", r."genreName")), ''), 'Genre pending') as genre,
          coalesce(sum(r."openCount"), 0)::bigint as opens,
          coalesce(sum(save_counts.saves), 0)::bigint as count
        from "Release" r
        left join save_counts on save_counts."releaseId" = r."id"
        where r."isHidden" = false
        group by coalesce(nullif(trim(coalesce(r."genreOverride", r."genreName")), ''), 'Genre pending')
        having coalesce(sum(r."openCount"), 0) > 0 or coalesce(sum(save_counts.saves), 0) > 0
        order by count desc, opens desc, genre asc
        limit 8
      `),
      prisma.$queryRaw<SaveConversionByTypeRow[]>(Prisma.sql`
        with save_counts as (
          select usr."releaseId", count(*)::bigint as saves
          from "UserSavedRelease" usr
          group by usr."releaseId"
        )
        select
          r."releaseType" as "releaseType",
          coalesce(sum(save_counts.saves), 0)::bigint as saves,
          coalesce(sum(r."openCount"), 0)::bigint as opens
        from "Release" r
        left join save_counts on save_counts."releaseId" = r."id"
        where r."isHidden" = false
        group by r."releaseType"
        order by opens desc, saves desc, r."releaseType" asc
      `),
      prisma.$queryRaw<SourcePerformanceRow[]>(Prisma.sql`
        with save_counts as (
          select usr."releaseId", count(*)::bigint as saves
          from "UserSavedRelease" usr
          group by usr."releaseId"
        )
        select
          coalesce(nullif(trim(r."outletName"), ''), 'Source pending') as source,
          coalesce(sum(r."openCount"), 0)::bigint as opens,
          coalesce(sum(r."listenClickCount"), 0)::bigint as "listenClicks",
          coalesce(sum(r."shareCount"), 0)::bigint as shares,
          coalesce(sum(save_counts.saves), 0)::bigint as saves
        from "Release" r
        left join save_counts on save_counts."releaseId" = r."id"
        where r."isHidden" = false
        group by coalesce(nullif(trim(r."outletName"), ''), 'Source pending')
        having
          coalesce(sum(r."openCount"), 0) > 0 or
          coalesce(sum(r."listenClickCount"), 0) > 0 or
          coalesce(sum(save_counts.saves), 0) > 0
        order by opens desc, "listenClicks" desc, saves desc, source asc
        limit 8
      `),
      prisma.$queryRaw<EditorialPerformanceRow[]>(Prisma.sql`
        with save_counts as (
          select usr."releaseId", count(*)::bigint as saves
          from "UserSavedRelease" usr
          group by usr."releaseId"
        )
        select
          case
            when r."isFeatured" = true then 'Featured'
            when r."editorialRank" > 0 then 'Ranked editorial'
            else 'Standard feed'
          end as status,
          count(*)::bigint as "releaseCount",
          coalesce(sum(r."openCount"), 0)::bigint as opens,
          coalesce(sum(save_counts.saves), 0)::bigint as saves
        from "Release" r
        left join save_counts on save_counts."releaseId" = r."id"
        where r."isHidden" = false
        group by
          case
            when r."isFeatured" = true then 'Featured'
            when r."editorialRank" > 0 then 'Ranked editorial'
            else 'Standard feed'
          end
        order by opens desc, saves desc, status asc
      `),
      prisma.$queryRaw<FollowPathwayRow[]>(Prisma.sql`
        select
          uf."targetType"::text as pathway,
          count(*)::bigint as count
        from "UserFollow" uf
        group by uf."targetType"
        order by count(*) desc, uf."targetType" asc
      `),
      prisma.$queryRaw<DailyTrendRow[]>(Prisma.sql`
        with days as (
          select to_char(day_bucket, 'YYYY-MM-DD') as "dateKey"
          from generate_series(
            date_trunc('day', now()) - interval '13 day',
            date_trunc('day', now()),
            interval '1 day'
          ) as day_bucket
        ),
        opens as (
          select to_char(date_trunc('day', ae."createdAt"), 'YYYY-MM-DD') as "dateKey", count(*)::bigint as count
          from "AnalyticsEvent" ae
          where ae."action" = 'OPEN'
            and ae."createdAt" >= now() - interval '14 day'
          group by 1
        ),
        saves as (
          select to_char(date_trunc('day', usr."createdAt"), 'YYYY-MM-DD') as "dateKey", count(*)::bigint as count
          from "UserSavedRelease" usr
          where usr."createdAt" >= now() - interval '14 day'
          group by 1
        ),
        follows as (
          select to_char(date_trunc('day', uf."createdAt"), 'YYYY-MM-DD') as "dateKey", count(*)::bigint as count
          from "UserFollow" uf
          where uf."createdAt" >= now() - interval '14 day'
          group by 1
        ),
        queued as (
          select to_char(date_trunc('day', nj."queuedAt"), 'YYYY-MM-DD') as "dateKey", count(*)::bigint as count
          from "NotificationJob" nj
          where nj."queuedAt" >= now() - interval '14 day'
          group by 1
        ),
        sent as (
          select to_char(date_trunc('day', nj."queuedAt"), 'YYYY-MM-DD') as "dateKey", count(*)::bigint as count
          from "NotificationJob" nj
          where nj."queuedAt" >= now() - interval '14 day'
            and nj."status" = 'SENT'
          group by 1
        ),
        failed as (
          select to_char(date_trunc('day', nj."queuedAt"), 'YYYY-MM-DD') as "dateKey", count(*)::bigint as count
          from "NotificationJob" nj
          where nj."queuedAt" >= now() - interval '14 day'
            and nj."status" = 'FAILED'
          group by 1
        ),
        skipped as (
          select to_char(date_trunc('day', nj."queuedAt"), 'YYYY-MM-DD') as "dateKey", count(*)::bigint as count
          from "NotificationJob" nj
          where nj."queuedAt" >= now() - interval '14 day'
            and nj."status" = 'SKIPPED'
          group by 1
        )
        select
          days."dateKey",
          coalesce(opens.count, 0)::bigint as opens,
          coalesce(saves.count, 0)::bigint as saves,
          coalesce(follows.count, 0)::bigint as follows,
          coalesce(queued.count, 0)::bigint as "notificationQueued",
          coalesce(sent.count, 0)::bigint as "notificationSent",
          coalesce(failed.count, 0)::bigint as "notificationFailed",
          coalesce(skipped.count, 0)::bigint as "notificationSkipped"
        from days
        left join opens on opens."dateKey" = days."dateKey"
        left join saves on saves."dateKey" = days."dateKey"
        left join follows on follows."dateKey" = days."dateKey"
        left join queued on queued."dateKey" = days."dateKey"
        left join sent on sent."dateKey" = days."dateKey"
        left join failed on failed."dateKey" = days."dateKey"
        left join skipped on skipped."dateKey" = days."dateKey"
        order by days."dateKey" desc
      `),
      prisma.$queryRaw<PublicMetricCoverageRow[]>(Prisma.sql`
        select
          count(*)::bigint as "visibleReleases",
          count(*) filter (where coalesce(r."youtubeViewCount", 0) > 0)::bigint as "youtubeVisible",
          count(*) filter (
            where (
              r."youtubeUrl" is not null
              or r."youtubeMusicUrl" is not null
              or r."sourceUrl" ilike '%youtube.com%'
              or r."sourceUrl" ilike '%youtu.be%'
            )
            and coalesce(r."youtubeViewCount", 0) <= 0
          )::bigint as "youtubeMissingViews",
          count(*) filter (
            where (
              r."youtubeUrl" is not null
              or r."youtubeMusicUrl" is not null
              or r."sourceUrl" ilike '%youtube.com%'
              or r."sourceUrl" ilike '%youtu.be%'
            )
            and coalesce(r."youtubeViewCount", 0) <= 0
            and r."publishedAt" >= now() - interval '3 day'
          )::bigint as "recentYoutubeMissingViews",
          count(*) filter (where coalesce(r."score", 0) > 0)::bigint as "redditUpvoteVisible",
          count(*) filter (where coalesce(r."commentCount", 0) > 0)::bigint as "redditCommentVisible",
          count(*) filter (where coalesce(r."bandcampSupporterCount", 0) > 0)::bigint as "bandcampSupporterVisible",
          count(*) filter (where coalesce(r."bandcampFollowerCount", 0) > 0)::bigint as "bandcampFollowerVisible",
          count(*) filter (
            where coalesce(r."bandcampSupporterCount", 0) > 0
              or coalesce(r."bandcampFollowerCount", 0) > 0
          )::bigint as "bandcampMetricVisible",
          count(*) filter (
            where (
              r."youtubeUrl" is not null
              or r."youtubeMusicUrl" is not null
              or r."sourceUrl" ilike '%youtube.com%'
              or r."sourceUrl" ilike '%youtu.be%'
            )
            and (
              r."youtubeMetadataUpdatedAt" is null
              or r."youtubeMetadataUpdatedAt" < now() - interval '8 day'
            )
          )::bigint as "youtubeMetadataStale",
          count(*) filter (
            where r."redditPermalink" is not null
              and coalesce(r."score", 0) <= 0
          )::bigint as "missingRedditScoreForRedditSource",
          count(*) filter (
            where coalesce(r."youtubeViewCount", 0) <= 0
              and coalesce(r."score", 0) <= 0
              and coalesce(r."commentCount", 0) <= 0
              and coalesce(r."bandcampSupporterCount", 0) <= 0
              and coalesce(r."bandcampFollowerCount", 0) <= 0
          )::bigint as "noPublicMetric"
        from "Release" r
        where r."isHidden" = false
      `),
    ]);

    const topSavedReleaseIds = topSavedReleaseGroups.map((entry) => entry.releaseId);
    const topSavedReleaseMap = new Map(
      (await getReleaseListingItemsByIds(topSavedReleaseIds)).map((release) => [release.id, release]),
    );

    const saveUserCount = usersWithSaves.length;
    const followUserCount = usersWithFollows.length;
    const radarUserCount = new Set([
      ...usersWithSaves.map((entry) => entry.userId),
      ...usersWithFollows.map((entry) => entry.userId),
    ]).size;
    const notificationEligibleCount = Number(notificationEligibleRows[0]?.count || 0);
    const detailOpenCount = await prisma.release.aggregate({
      where: {
        isHidden: false,
      },
      _sum: {
        openCount: true,
      },
    });
    const totalDetailOpens = detailOpenCount._sum.openCount || 0;
    const publicMetricCoverage = publicMetricCoverageRows[0];
    const visibleReleaseCount = Number(publicMetricCoverage?.visibleReleases || 0);
    const noPublicMetricCount = Number(publicMetricCoverage?.noPublicMetric || 0);

    return {
      funnel: {
        totalUsers,
        saveUsers: saveUserCount,
        followUsers: followUserCount,
        radarUsers: radarUserCount,
        notificationUsers: notificationPreferenceUsers,
        notificationEligibleUsers: notificationEligibleCount,
        notificationAdoptionRate:
          radarUserCount > 0 ? roundToOneDecimal((notificationPreferenceUsers / radarUserCount) * 100) : 0,
        notificationEligibleRate:
          radarUserCount > 0 ? roundToOneDecimal((notificationEligibleCount / radarUserCount) * 100) : 0,
      },
      conversion: {
        totalSaves,
        totalFollows,
        totalOpens,
        savesPer100Opens: totalOpens > 0 ? roundToOneDecimal((totalSaves / totalOpens) * 100) : 0,
        followsPer100Opens: totalOpens > 0 ? roundToOneDecimal((totalFollows / totalOpens) * 100) : 0,
        detailOpens: totalDetailOpens,
        detailToSavePer100Opens:
          totalDetailOpens > 0 ? roundToOneDecimal((totalSaves / totalDetailOpens) * 100) : 0,
        detailToFollowPer100Opens:
          totalDetailOpens > 0 ? roundToOneDecimal((totalFollows / totalDetailOpens) * 100) : 0,
      },
      notifications: {
        pending: readNotificationJobCount(notificationJobGroups, NotificationJobStatus.PENDING),
        processing: readNotificationJobCount(notificationJobGroups, NotificationJobStatus.PROCESSING),
        sent: readNotificationJobCount(notificationJobGroups, NotificationJobStatus.SENT),
        failed: readNotificationJobCount(notificationJobGroups, NotificationJobStatus.FAILED),
        skipped: readNotificationJobCount(notificationJobGroups, NotificationJobStatus.SKIPPED),
      },
      publicMetricCoverage: {
        visibleReleases: visibleReleaseCount,
        youtubeVisible: Number(publicMetricCoverage?.youtubeVisible || 0),
        youtubeMissingViews: Number(publicMetricCoverage?.youtubeMissingViews || 0),
        recentYoutubeMissingViews: Number(publicMetricCoverage?.recentYoutubeMissingViews || 0),
        redditUpvoteVisible: Number(publicMetricCoverage?.redditUpvoteVisible || 0),
        redditCommentVisible: Number(publicMetricCoverage?.redditCommentVisible || 0),
        bandcampSupporterVisible: Number(publicMetricCoverage?.bandcampSupporterVisible || 0),
        bandcampFollowerVisible: Number(publicMetricCoverage?.bandcampFollowerVisible || 0),
        bandcampMetricVisible: Number(publicMetricCoverage?.bandcampMetricVisible || 0),
        youtubeMetadataStale: Number(publicMetricCoverage?.youtubeMetadataStale || 0),
        missingRedditScoreForRedditSource: Number(publicMetricCoverage?.missingRedditScoreForRedditSource || 0),
        noPublicMetric: noPublicMetricCount,
        bestSignalCoverageRate:
          visibleReleaseCount > 0
            ? roundToOneDecimal(((visibleReleaseCount - noPublicMetricCount) / visibleReleaseCount) * 100)
            : 0,
      },
      topSavedReleases: topSavedReleaseGroups
        .map((entry) => ({
          release: topSavedReleaseMap.get(entry.releaseId) || null,
          count: entry._count._all,
        }))
        .filter((entry) => entry.release),
      topFollowedArtists: topFollowArtistGroups.map((entry) => ({
        label: entry.targetValue,
        count: entry._count._all,
      })),
      topFollowedLabels: topFollowLabelGroups.map((entry) => ({
        label: entry.targetValue,
        count: entry._count._all,
      })),
      genrePerformance: genrePerformanceRows.map((entry) => ({
        label: entry.genre,
        opens: Number(entry.opens),
        count: Number(entry.count),
        savesPer100Opens:
          Number(entry.opens) > 0 ? roundToOneDecimal((Number(entry.count) / Number(entry.opens)) * 100) : 0,
      })),
      saveConversionByType: saveConversionByTypeRows.map((entry) => ({
        label: formatReleaseTypeLabel(entry.releaseType),
        saves: Number(entry.saves),
        opens: Number(entry.opens),
        savesPer100Opens:
          Number(entry.opens) > 0 ? roundToOneDecimal((Number(entry.saves) / Number(entry.opens)) * 100) : 0,
      })),
      sourcePerformance: sourcePerformanceRows.map((entry) => ({
        label: entry.source,
        opens: Number(entry.opens),
        listenClicks: Number(entry.listenClicks),
        shares: Number(entry.shares),
        saves: Number(entry.saves),
        savesPer100Opens:
          Number(entry.opens) > 0 ? roundToOneDecimal((Number(entry.saves) / Number(entry.opens)) * 100) : 0,
      })),
      editorialPerformance: editorialPerformanceRows.map((entry) => ({
        label: entry.status,
        releaseCount: Number(entry.releaseCount),
        opens: Number(entry.opens),
        saves: Number(entry.saves),
        savesPer100Opens:
          Number(entry.opens) > 0 ? roundToOneDecimal((Number(entry.saves) / Number(entry.opens)) * 100) : 0,
      })),
      followPathways: followPathwayRows.map((entry) => ({
        label: entry.pathway === "ARTIST" ? "Artist follows" : entry.pathway === "LABEL" ? "Label follows" : entry.pathway,
        count: Number(entry.count),
      })),
      dailyTrends: dailyTrendRows.map((entry) => ({
        dateKey: entry.dateKey,
        label: formatTrendDate(entry.dateKey),
        opens: Number(entry.opens),
        saves: Number(entry.saves),
        follows: Number(entry.follows),
        notificationQueued: Number(entry.notificationQueued),
        notificationSent: Number(entry.notificationSent),
        notificationFailed: Number(entry.notificationFailed),
        notificationSkipped: Number(entry.notificationSkipped),
      })),
    };
  },
  ["admin-product-analytics"],
  {
    revalidate: 60,
    tags: ["ops-dashboard", "analytics", "releases"],
  },
);

async function getEditorialCollections() {
  const collections = await prisma.editorialCollection.findMany({
    orderBy: [{ isPublished: "desc" }, { updatedAt: "desc" }],
    take: 12,
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      type: true,
      isPublished: true,
      publishedAt: true,
      updatedAt: true,
      entries: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        take: 6,
        select: {
          id: true,
          position: true,
          note: true,
          release: {
            select: {
              id: true,
              slug: true,
              title: true,
              artistName: true,
              projectTitle: true,
              genreName: true,
              genreOverride: true,
              publishedAt: true,
            },
          },
        },
      },
    },
  });

  return collections.map((collection) => ({
    ...collection,
    entries: collection.entries.map((entry) => ({
      id: entry.id,
      position: entry.position,
      note: entry.note,
      release: {
        ...entry.release,
        genreName: entry.release.genreOverride?.trim() || entry.release.genreName,
      },
    })),
  }));
}

async function getFeaturedReleaseRows() {
  const releases = await prisma.release.findMany({
    where: buildVisibleReleaseWhere({ isFeatured: true }),
    orderBy: [{ editorialRank: "desc" }, { featuredAt: "desc" }, { publishedAt: "desc" }],
    take: 10,
    select: {
      id: true,
      slug: true,
      title: true,
      artistName: true,
      projectTitle: true,
      genreName: true,
      genreOverride: true,
      featuredAt: true,
      editorialRank: true,
      publishedAt: true,
    },
  });

  return releases.map((release) => ({
    ...release,
    genreName: release.genreOverride?.trim() || release.genreName,
  }));
}

async function searchAdminReleases(query: string) {
  const releases = await prisma.release.findMany({
    where: {
      OR: [
        { slug: { contains: query, mode: "insensitive" } },
        { title: { contains: query, mode: "insensitive" } },
        { artistName: { contains: query, mode: "insensitive" } },
        { projectTitle: { contains: query, mode: "insensitive" } },
        { labelName: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
    take: ADMIN_SEARCH_LIMIT,
    select: {
      id: true,
      slug: true,
      title: true,
      artistName: true,
      projectTitle: true,
      labelName: true,
      genreName: true,
      genreOverride: true,
      summary: true,
      summaryOverride: true,
      imageUrl: true,
      imageUrlOverride: true,
      sourceUrl: true,
      sourceUrlOverride: true,
      youtubeUrl: true,
      youtubeMusicUrl: true,
      youtubeViewCount: true,
      youtubePublishedAt: true,
      bandcampUrl: true,
      bandcampSupporterCount: true,
      bandcampFollowerCount: true,
      bandcampMetadataUpdatedAt: true,
      officialWebsiteUrl: true,
      officialStoreUrl: true,
      releaseType: true,
      publishedAt: true,
      qualityScore: true,
      isHidden: true,
      hiddenReason: true,
      isFeatured: true,
      editorialRank: true,
      editorialNotes: true,
      featuredAt: true,
      editorialUpdatedAt: true,
      externalSources: {
        orderBy: [{ updatedAt: "desc" }],
        take: 6,
        select: {
          id: true,
          sourceName: true,
          sourceUrl: true,
          title: true,
          summary: true,
          sourceType: true,
          publishedAt: true,
          isVisible: true,
          updatedAt: true,
        },
      },
    },
  });

  return releases.map((release) => applyReleaseEditorialFields(release satisfies SearchReleaseRow));
}

async function getRecentEditorialAudits() {
  return prisma.releaseEditorialAudit.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: 18,
    select: {
      id: true,
      action: true,
      detailsJson: true,
      createdAt: true,
      editor: {
        select: {
          email: true,
          displayName: true,
        },
      },
      release: {
        select: {
          slug: true,
          title: true,
          artistName: true,
          projectTitle: true,
        },
      },
    },
  });
}

async function getRoleRoster() {
  return prisma.userProfile.findMany({
    where: {
      role: {
        in: [UserRole.EDITOR, UserRole.ADMIN],
      },
    },
    orderBy: [{ role: "desc" }, { updatedAt: "desc" }],
    take: 24,
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      createdAt: true,
    },
  }) satisfies Promise<RoleRosterRow[]>;
}

async function getRecentRoleAssignments() {
  return prisma.userRoleAssignmentAudit.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: 12,
    select: {
      id: true,
      previousRole: true,
      nextRole: true,
      reason: true,
      createdAt: true,
      actor: {
        select: {
          email: true,
          displayName: true,
        },
      },
      target: {
        select: {
          email: true,
          displayName: true,
        },
      },
    },
  });
}

function readNotificationJobCount(
  rows: Array<{ status: NotificationJobStatus; _count: { _all: number } }>,
  status: NotificationJobStatus,
) {
  return rows.find((row) => row.status === status)?._count._all || 0;
}

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function formatReleaseTypeLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTrendDate(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-GB", { month: "short", day: "numeric", timeZone: "UTC" });
}
