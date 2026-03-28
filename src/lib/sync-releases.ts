import { ReleaseType } from "@/generated/prisma/enums";
import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { generateAiSummary, shouldRegenerateAiSummary } from "@/lib/ai-summary";
import { buildGenreProfile, isSpecificGenreProfile } from "@/lib/genre-profile";
import { getGenreOverride } from "@/lib/genre-overrides";
import { fetchRedditPosts, normalizeRedditPost, shouldKeepReleaseRecord } from "@/lib/reddit";
import { enrichRecentReleases } from "@/lib/release-enrichment";
import { resolveSourceMetadata } from "@/lib/source-metadata";

type SyncResult = {
  scanned: number;
  matched: number;
  created: number;
  updated: number;
  failed: number;
  removed: number;
  sanitized: number;
  enriched: number;
};

type SyncOptions = {
  enrich?: boolean;
  lightweight?: boolean;
};

type NormalizedReleaseRecord = NonNullable<ReturnType<typeof normalizeRedditPost>>;

const HOMEPAGE_SYNC_POST_LIMIT = 36;

declare global {
  var __moosqaHomepageSyncPromise: Promise<SyncResult> | null | undefined;
}

export async function syncIndieheadsReleases(options: SyncOptions = {}) {
  const { enrich = true, lightweight = true } = options;
  await ensureDatabase();
  const removed = await purgeFilteredReleases();
  const sanitized = await sanitizeStoredMetadata();
  const posts = await fetchRedditPosts();
  const releases = posts
    .map(normalizeRedditPost)
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const { created, updated, failed } = await upsertNormalizedReleases(releases, { lightweight });

  const enriched = enrich ? await enrichRecentReleases(Math.max(12, sanitized + created)) : 0;

  return {
    scanned: posts.length,
    matched: releases.length,
    created,
    updated,
    failed,
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
        { genreName: { equals: "Indie / Alternative" } },
        { genreName: { equals: "Alternative / Indie" } },
        { genreName: { equals: "alternative / indie" } },
        { genreName: { equals: "indie / alternative" } },
        { genreName: { equals: "Alternative" } },
        { genreName: { equals: "alternative" } },
        { genreName: { equals: "Indie Alternative" } },
        { genreName: { equals: "Single release" } },
        { genreName: { equals: "Album release" } },
        { genreName: { equals: "EP release" } },
        { genreName: { equals: "Live / Session" } },
        { genreName: { equals: "Live performance" } },
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

  const syncPromise = syncLatestHomepageReleases();
  globalThis.__moosqaHomepageSyncPromise = syncPromise;

  try {
    return await syncPromise;
  } finally {
    globalThis.__moosqaHomepageSyncPromise = null;
  }
}

async function syncLatestHomepageReleases() {
  const posts = await fetchRedditPosts();
  const releases = posts
    .map(normalizeRedditPost)
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .slice(0, HOMEPAGE_SYNC_POST_LIMIT);

  const { created, updated, failed } = await upsertNormalizedReleases(releases, {
    lightweight: true,
  });

  return {
    scanned: posts.length,
    matched: releases.length,
    created,
    updated,
    failed,
    removed: 0,
    sanitized: 0,
    enriched: 0,
  };
}

async function upsertNormalizedReleases(
  releases: NormalizedReleaseRecord[],
  options: { lightweight?: boolean } = {},
) {
  const { lightweight = false } = options;
  let created = 0;
  let updated = 0;
  let failed = 0;
  const existingReleases = await prisma.release.findMany({
    where: {
      sourceItemId: {
        in: releases.map((release) => release.sourceItemId),
      },
    },
    select: {
      id: true,
      sourceItemId: true,
      aiSummary: true,
      genreName: true,
      imageUrl: true,
      thumbnailUrl: true,
    },
  });
  const existingBySourceItemId = new Map(
    existingReleases.map((release) => [release.sourceItemId, release]),
  );

  for (const release of releases) {
    try {
      const existing = existingBySourceItemId.get(release.sourceItemId) || null;

      const releaseData = await buildReleaseDataForUpsert(release, existing, {
        lightweight,
      });

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
    } catch (error) {
      failed += 1;
      console.error(`Failed to upsert release ${release.sourceItemId}.`, error);
    }
  }

  return { created, updated, failed };
}

async function buildReleaseDataForUpsert(
  release: NormalizedReleaseRecord,
  existing: {
    id: string;
    aiSummary: string | null;
    genreName: string | null;
    imageUrl: string | null;
    thumbnailUrl: string | null;
  } | null,
  options: { lightweight?: boolean } = {},
) {
  if (options.lightweight) {
    const shouldHydrateSourceMetadata =
      (!release.imageUrl && !existing?.imageUrl && !existing?.thumbnailUrl) ||
      !existing?.genreName ||
      !isSpecificGenreProfile(existing.genreName);
    const sourceMetadata = shouldHydrateSourceMetadata
      ? await resolveSourceMetadata(release.sourceUrl, {
          artistName: release.artistName,
          projectTitle: release.projectTitle,
          title: release.title,
        })
      : null;

    return {
      ...release,
      imageUrl:
        release.imageUrl ||
        existing?.imageUrl ||
        existing?.thumbnailUrl ||
        sourceMetadata?.sourceImageUrl ||
        null,
      thumbnailUrl:
        release.thumbnailUrl ||
        existing?.thumbnailUrl ||
        release.imageUrl ||
        existing?.imageUrl ||
        sourceMetadata?.sourceImageUrl ||
        null,
      genreName: resolvePreferredGenre({
        currentGenre: existing?.genreName || null,
        fallbackGenre: sourceMetadata?.genreName || null,
        release,
        sourceMetadata,
      }),
      aiSummary: existing?.aiSummary || null,
    };
  }

  const sourceMetadata =
    !release.imageUrl && !existing?.imageUrl
      ? await resolveSourceMetadata(release.sourceUrl, {
          artistName: release.artistName,
          projectTitle: release.projectTitle,
          title: release.title,
        })
      : null;
  const fallbackGenre = resolvePreferredGenre({
    currentGenre: existing?.genreName || null,
    fallbackGenre: sourceMetadata?.genreName || null,
    release,
    sourceMetadata,
  });
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

  return {
    ...release,
    imageUrl: release.imageUrl || existing?.imageUrl || sourceMetadata?.sourceImageUrl || null,
    thumbnailUrl:
      release.thumbnailUrl ||
      existing?.thumbnailUrl ||
      release.imageUrl ||
      existing?.imageUrl ||
      sourceMetadata?.sourceImageUrl ||
      null,
    genreName: fallbackGenre,
    aiSummary: fallbackAiSummary,
  };
}

function resolvePreferredGenre(input: {
  currentGenre: string | null;
  fallbackGenre: string | null;
  release: NormalizedReleaseRecord;
  sourceMetadata?: {
    sourceTitle?: string | null;
    sourceExcerpt?: string | null;
    labelName?: string | null;
  } | null;
}) {
  const specificStoredGenre = input.currentGenre?.trim();
  if (specificStoredGenre && isSpecificGenreProfile(specificStoredGenre)) {
    return specificStoredGenre;
  }

  const specificFallbackGenre = input.fallbackGenre?.trim();
  if (specificFallbackGenre && isSpecificGenreProfile(specificFallbackGenre)) {
    return specificFallbackGenre;
  }

  const synthesizedGenre = buildGenreProfile({
    explicitGenres: [input.currentGenre, input.fallbackGenre],
    text: [
      input.release.title,
      input.release.projectTitle,
      input.release.summary,
      input.sourceMetadata?.sourceTitle,
      input.sourceMetadata?.sourceExcerpt,
    ]
      .filter(Boolean)
      .join(". "),
    artistName: input.release.artistName,
    projectTitle: input.release.projectTitle,
    title: input.release.title,
    labelName: input.sourceMetadata?.labelName || null,
    limit: 3,
  });

  const overrideGenre = getGenreOverride(input.release);
  if (overrideGenre) {
    return overrideGenre;
  }

  if (synthesizedGenre) {
    return synthesizedGenre;
  }

  return null;
}
