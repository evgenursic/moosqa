import { ReleaseType } from "@/generated/prisma/enums";
import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { generateAiSummary, shouldRegenerateAiSummary } from "@/lib/ai-summary";
import { fetchRedditPosts, normalizeRedditPost, shouldKeepReleaseRecord } from "@/lib/reddit";
import { enrichRecentReleases } from "@/lib/release-enrichment";
import { getDisplayGenre } from "@/lib/utils";

type SyncResult = {
  scanned: number;
  matched: number;
  created: number;
  updated: number;
  removed: number;
  sanitized: number;
  enriched: number;
};

type SyncOptions = {
  enrich?: boolean;
};

declare global {
  var __moosqaHomepageSyncPromise: Promise<SyncResult> | null | undefined;
}

export async function syncIndieheadsReleases(options: SyncOptions = {}) {
  const { enrich = true } = options;
  await ensureDatabase();
  const removed = await purgeFilteredReleases();
  const sanitized = await sanitizeStoredMetadata();
  const posts = await fetchRedditPosts();
  const releases = posts
    .map(normalizeRedditPost)
    .filter((item): item is NonNullable<typeof item> => item !== null);

  let created = 0;
  let updated = 0;

  for (const release of releases) {
    const existing = await prisma.release.findUnique({
      where: { sourceItemId: release.sourceItemId },
      select: { id: true, aiSummary: true, genreName: true },
    });
    const fallbackGenre = existing?.genreName || getDisplayGenre(null, release.releaseType);
    const fallbackAiSummary =
      existing?.aiSummary ||
      (await generateAiSummary({
        artistName: release.artistName,
        projectTitle: release.projectTitle,
        title: release.title,
        genreName: fallbackGenre,
        releaseType: release.releaseType,
        sourceExcerpt: release.summary,
        sourceTitle: release.title,
        outletName: release.outletName,
        labelName: null,
      }));
    const releaseData = {
      ...release,
      genreName: fallbackGenre,
      aiSummary: fallbackAiSummary,
    };

    await prisma.release.upsert({
      where: { sourceItemId: release.sourceItemId },
      update: releaseData,
      create: releaseData,
    });

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  const enriched = enrich ? await enrichRecentReleases(Math.max(24, sanitized + created)) : 0;

  return {
    scanned: posts.length,
    matched: releases.length,
    created,
    updated,
    removed,
    sanitized,
    enriched,
  };
}

export async function refreshHomepageData() {
  await ensureDatabase();

  try {
    await runSharedHomepageSync();
    return;
  } catch (error) {
    console.error("Homepage refresh sync failed.", error);
  }

  const removed = await purgeFilteredReleases();
  const sanitized = await sanitizeStoredMetadata();
  if (removed > 0 || sanitized > 0) {
    await enrichRecentReleases(Math.max(18, removed + sanitized));
  }
}

export async function ensureSeedData() {
  await refreshHomepageData();
}

export async function getHomepageData() {
  await ensureDatabase();
  const releases = await prisma.release.findMany({
    orderBy: { publishedAt: "desc" },
  });

  const featured =
    releases.find((item) => item.releaseType === ReleaseType.ALBUM && item.imageUrl) ||
    releases.find((item) => item.imageUrl) ||
    releases[0] ||
    null;

  const albums = releases.filter(
    (item) => item.releaseType === ReleaseType.ALBUM || item.releaseType === ReleaseType.EP,
  );
  const singles = releases.filter((item) => item.releaseType === ReleaseType.SINGLE);
  const performances = releases.filter((item) => item.releaseType === ReleaseType.PERFORMANCE);
  const eps = releases.filter((item) => item.releaseType === ReleaseType.EP);
  const ratedReleases = releases.filter((item) => item.scoreCount > 0);

  const stats = {
    total: releases.length,
    albumsThisWeek: albums.length,
    singlesToday: singles.slice(0, 12).length,
    epsTotal: eps.length,
    liveTotal: performances.length,
    avgScore:
      ratedReleases.reduce((acc, item) => acc + item.scoreAverage, 0) / Math.max(1, ratedReleases.length),
  };

  return {
    featured,
    releases,
    albums,
    singles,
    performances,
    stats,
  };
}

export async function getReleaseBySlug(slug: string) {
  await ensureDatabase();
  return prisma.release.findUnique({
    where: { slug },
  });
}

async function purgeFilteredReleases() {
  const releases = await prisma.release.findMany({
    select: {
      id: true,
      source: true,
      title: true,
      releaseType: true,
      sourceUrl: true,
      flair: true,
    },
  });

  const removableIds = releases
    .filter(
      (release) =>
        release.source === "REDDIT" &&
        !shouldKeepReleaseRecord({
          title: release.title,
          releaseType: release.releaseType,
          sourceUrl: release.sourceUrl,
          flair: release.flair,
        }),
    )
    .map((release) => release.id);

  if (removableIds.length === 0) {
    return 0;
  }

  await prisma.vote.deleteMany({
    where: {
      releaseId: {
        in: removableIds,
      },
    },
  });

  const deletedReleases = await prisma.release.deleteMany({
    where: {
      id: {
        in: removableIds,
      },
    },
  });

  return deletedReleases.count;
}

async function sanitizeStoredMetadata() {
  const result = await prisma.release.updateMany({
    where: {
      OR: [
        { genreName: { startsWith: "http" } },
        { genreName: { equals: "https:" } },
        { genreName: { equals: "http:" } },
        { genreName: { contains: "schema.org" } },
        { genreName: { equals: "musicrecording" } },
        { genreName: { equals: "singlerelease" } },
        { genreName: { equals: "albumrelease" } },
        { genreName: { equals: "eprelease" } },
        { labelName: { startsWith: "http" } },
        { labelName: { contains: "schema.org" } },
        { aiSummary: { contains: "schema.googleapis.com" } },
        { aiSummary: { contains: "schema.org" } },
        { aiSummary: { contains: "lands with a " } },
        { aiSummary: { contains: "arrives with a focused " } },
        { aiSummary: { contains: "easy to place on a first listen" } },
        { aiSummary: { contains: "opening moments" } },
        { aiSummary: { contains: "clean entry point" } },
        { aiSummary: { contains: "rather than overloading the arrangement" } },
        { aiSummary: { contains: "the main motif carries" } },
        { aiSummary: { contains: "built around strong tonal contrast" } },
      ],
    },
    data: {
      genreName: null,
      labelName: null,
      aiSummary: null,
      metadataEnrichedAt: null,
    },
  });

  const genericSummaryRows = await prisma.release.findMany({
    where: {
      aiSummary: {
        not: null,
      },
    },
    select: {
      id: true,
      aiSummary: true,
    },
  });

  const genericSummaryIds = genericSummaryRows
    .filter((release) => shouldRegenerateAiSummary(release.aiSummary))
    .map((release) => release.id);

  if (genericSummaryIds.length > 0) {
    await prisma.release.updateMany({
      where: {
        id: {
          in: genericSummaryIds,
        },
      },
      data: {
        aiSummary: null,
        metadataEnrichedAt: null,
      },
    });
  }

  return result.count + genericSummaryIds.length;
}

async function runSharedHomepageSync() {
  if (globalThis.__moosqaHomepageSyncPromise) {
    return globalThis.__moosqaHomepageSyncPromise;
  }

  const syncPromise = syncIndieheadsReleases({ enrich: false });
  globalThis.__moosqaHomepageSyncPromise = syncPromise;

  try {
    return await syncPromise;
  } finally {
    globalThis.__moosqaHomepageSyncPromise = null;
  }
}
