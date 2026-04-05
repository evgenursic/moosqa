import { ReleaseType } from "@/generated/prisma/enums";
import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { generateAiSummary, shouldRegenerateAiSummary } from "@/lib/ai-summary";
import { searchBandcampRelease } from "@/lib/bandcamp-search";
import { buildGenreProfile, isSpecificGenreProfile, pickPreferredGenreProfile } from "@/lib/genre-profile";
import { getGenreOverride } from "@/lib/genre-overrides";
import { fetchRedditPosts, normalizeRedditPost, shouldKeepReleaseRecord } from "@/lib/reddit";
import { enrichRecentReleases } from "@/lib/release-enrichment";
import { clearReleaseDataCaches } from "@/lib/release-sections";
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

const HOMEPAGE_SYNC_STATE_KEY = "homepage-sync";
const HOMEPAGE_SYNC_STALE_MS = 45_000;
const RECENT_FEED_PRUNE_MIN_POSTS = 50;

declare global {
  var __moosqaHomepageSyncPromise: Promise<SyncResult> | null | undefined;
  var __moosqaLastHomepageSyncAt: number | null | undefined;
}

export async function syncIndieheadsReleases(options: SyncOptions = {}) {
  const { enrich = true, lightweight = true } = options;
  await ensureDatabase();
  const filteredRemoved = await purgeFilteredReleases();
  const sanitized = await sanitizeStoredMetadata();
  const posts = await fetchRedditPosts();
  const releases = posts
    .map(normalizeRedditPost)
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const { created, updated, failed } = await upsertNormalizedReleases(releases, { lightweight });
  const missingRecentRemoved = await pruneMissingRecentReleases(posts, releases);

  const enrichTarget = lightweight
    ? Math.max(12, sanitized + created)
    : Math.max(60, sanitized + created + updated);
  const enriched = enrich ? await enrichRecentReleases(enrichTarget) : 0;
  await markHomepageSyncFresh();
  clearReleaseDataCaches();

  return {
    scanned: posts.length,
    matched: releases.length,
    created,
    updated,
    failed,
    removed: filteredRemoved + missingRecentRemoved,
    sanitized,
    enriched,
  };
}

export async function refreshHomepageData() {
  await ensureDatabase();

  try {
    if (await isHomepageSyncFresh()) {
      return;
    }

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
        { genreName: { equals: "Indie rock" } },
        { genreName: { equals: "indie rock" } },
        { genreName: { equals: "Alternative rock" } },
        { genreName: { equals: "alternative rock" } },
        { genreName: { equals: "Indie pop" } },
        { genreName: { equals: "indie pop" } },
        { genreName: { equals: "Alternative pop" } },
        { genreName: { equals: "alternative pop" } },
        { genreName: { equals: "Indie folk" } },
        { genreName: { equals: "indie folk" } },
        { genreName: { equals: "Folk rock" } },
        { genreName: { equals: "folk rock" } },
        { genreName: { equals: "Pop rock" } },
        { genreName: { equals: "pop rock" } },
        { genreName: { equals: "Punk rock" } },
        { genreName: { equals: "punk rock" } },
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
  const normalizedReleases = posts
    .map(normalizeRedditPost)
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const { created, updated, failed } = await upsertNormalizedReleases(normalizedReleases, {
    lightweight: true,
  });
  const missingRecentRemoved = await pruneMissingRecentReleases(posts, normalizedReleases);
  await markHomepageSyncFresh();
  clearReleaseDataCaches();

  return {
    scanned: posts.length,
    matched: normalizedReleases.length,
    created,
    updated,
    failed,
    removed: missingRecentRemoved,
    sanitized: 0,
    enriched: 0,
  };
}

async function isHomepageSyncFresh() {
  const now = Date.now();
  const cachedSyncAt = globalThis.__moosqaLastHomepageSyncAt ?? null;
  if (cachedSyncAt && now - cachedSyncAt < HOMEPAGE_SYNC_STALE_MS) {
    return true;
  }

  const syncState = await prisma.appState.findUnique({
    where: { key: HOMEPAGE_SYNC_STATE_KEY },
    select: { updatedAt: true },
  });

  if (!syncState) {
    return false;
  }

  globalThis.__moosqaLastHomepageSyncAt = syncState.updatedAt.getTime();
  return now - syncState.updatedAt.getTime() < HOMEPAGE_SYNC_STALE_MS;
}

async function markHomepageSyncFresh() {
  const syncedAt = new Date();
  globalThis.__moosqaLastHomepageSyncAt = syncedAt.getTime();

  await prisma.appState.upsert({
    where: { key: HOMEPAGE_SYNC_STATE_KEY },
    update: { value: syncedAt.toISOString() },
    create: {
      key: HOMEPAGE_SYNC_STATE_KEY,
      value: syncedAt.toISOString(),
    },
  });
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
      releaseDate: true,
      imageUrl: true,
      thumbnailUrl: true,
      youtubeUrl: true,
      youtubeMusicUrl: true,
      bandcampUrl: true,
      officialWebsiteUrl: true,
      officialStoreUrl: true,
      metadataEnrichedAt: true,
    },
  });
  const existingBySourceItemId = new Map(
    existingReleases.map((release) => [release.sourceItemId, release]),
  );
  const artistGenreHints = await loadArtistGenreHints(releases);

  for (const release of releases) {
    try {
      const existing = existingBySourceItemId.get(release.sourceItemId) || null;
      const artistGenreHint =
        artistGenreHints.get(normalizeArtistKey(release.artistName)) || null;

      const releaseData = await buildReleaseDataForUpsert(release, existing, {
        lightweight,
        artistGenreHint,
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
    releaseDate: Date | null;
    imageUrl: string | null;
    thumbnailUrl: string | null;
    youtubeUrl: string | null;
    youtubeMusicUrl: string | null;
    bandcampUrl: string | null;
    officialWebsiteUrl: string | null;
    officialStoreUrl: string | null;
    metadataEnrichedAt: Date | null;
  } | null,
  options: { lightweight?: boolean; artistGenreHint?: string | null } = {},
) {
  if (options.lightweight) {
    const hasStableListeningLinks =
      Boolean(existing?.youtubeUrl) &&
      Boolean(existing?.youtubeMusicUrl) &&
      Boolean(existing?.bandcampUrl);
    const hasStablePurchaseLink =
      !isPurchasableReleaseType(release.releaseType) ||
      Boolean(existing?.bandcampUrl || existing?.officialStoreUrl || existing?.officialWebsiteUrl);
    const recentlyEnriched =
      existing?.metadataEnrichedAt &&
      Date.now() - existing.metadataEnrichedAt.getTime() < 1000 * 60 * 20;
    const shouldHydrateSourceMetadata =
      (!release.imageUrl && !existing?.imageUrl && !existing?.thumbnailUrl) ||
      !existing?.genreName ||
      !isSpecificGenreProfile(existing.genreName) ||
      !hasStableListeningLinks ||
      !hasStablePurchaseLink ||
      !recentlyEnriched;
    const sourceMetadata = shouldHydrateSourceMetadata
      ? await resolveSourceMetadata(release.sourceUrl, {
          artistName: release.artistName,
          projectTitle: release.projectTitle,
          title: release.title,
        })
      : null;
    const initialGenre = resolvePreferredGenre({
      currentGenre: existing?.genreName || null,
      fallbackGenre: sourceMetadata?.genreName || null,
      artistGenreHint: options.artistGenreHint || null,
      release,
      sourceMetadata,
    });
    const needsSupplementalBandcampLookup =
      !initialGenre ||
      !sourceMetadata?.bandcampUrl ||
      (!release.imageUrl &&
        !existing?.imageUrl &&
        !existing?.thumbnailUrl &&
        !sourceMetadata?.sourceImageUrl);
    const supplementalSourceMetadata = needsSupplementalBandcampLookup
      ? await resolveSupplementalBandcampMetadata(release)
      : null;
    const effectiveSourceMetadata = mergeSourceMetadataHints(
      sourceMetadata,
      supplementalSourceMetadata,
    );

    return {
      ...release,
      releaseDate:
        existing?.releaseDate ||
        effectiveSourceMetadata?.releaseDate ||
        release.releaseDate ||
        null,
      imageUrl:
        release.imageUrl ||
        existing?.imageUrl ||
        existing?.thumbnailUrl ||
        effectiveSourceMetadata?.sourceImageUrl ||
        null,
      thumbnailUrl:
        release.thumbnailUrl ||
        existing?.thumbnailUrl ||
        release.imageUrl ||
        existing?.imageUrl ||
        effectiveSourceMetadata?.sourceImageUrl ||
        null,
      genreName: resolvePreferredGenre({
        currentGenre: existing?.genreName || null,
        fallbackGenre: effectiveSourceMetadata?.genreName || null,
        artistGenreHint: options.artistGenreHint || null,
        release,
        sourceMetadata: effectiveSourceMetadata,
      }),
      youtubeUrl:
        effectiveSourceMetadata?.youtubeUrl ||
        existing?.youtubeUrl ||
        null,
      youtubeMusicUrl:
        effectiveSourceMetadata?.youtubeMusicUrl ||
        existing?.youtubeMusicUrl ||
        null,
      bandcampUrl:
        effectiveSourceMetadata?.bandcampUrl ||
        existing?.bandcampUrl ||
        null,
      officialWebsiteUrl:
        effectiveSourceMetadata?.officialWebsiteUrl ||
        existing?.officialWebsiteUrl ||
        null,
      officialStoreUrl:
        effectiveSourceMetadata?.officialStoreUrl ||
        existing?.officialStoreUrl ||
        null,
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
    artistGenreHint: options.artistGenreHint || null,
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
    releaseDate:
      release.releaseDate ||
      sourceMetadata?.releaseDate ||
      existing?.releaseDate ||
      null,
    imageUrl: release.imageUrl || existing?.imageUrl || sourceMetadata?.sourceImageUrl || null,
    thumbnailUrl:
      release.thumbnailUrl ||
      existing?.thumbnailUrl ||
      release.imageUrl ||
      existing?.imageUrl ||
      sourceMetadata?.sourceImageUrl ||
      null,
    genreName: fallbackGenre,
    youtubeUrl: sourceMetadata?.youtubeUrl || existing?.youtubeUrl || null,
    youtubeMusicUrl: sourceMetadata?.youtubeMusicUrl || existing?.youtubeMusicUrl || null,
    bandcampUrl: sourceMetadata?.bandcampUrl || existing?.bandcampUrl || null,
    officialWebsiteUrl: sourceMetadata?.officialWebsiteUrl || existing?.officialWebsiteUrl || null,
    officialStoreUrl: sourceMetadata?.officialStoreUrl || existing?.officialStoreUrl || null,
    aiSummary: fallbackAiSummary,
  };
}

async function pruneMissingRecentReleases(
  posts: Awaited<ReturnType<typeof fetchRedditPosts>>,
  releases: NormalizedReleaseRecord[],
) {
  if (posts.length < RECENT_FEED_PRUNE_MIN_POSTS) {
    return 0;
  }

  const retainedIds = new Set(releases.map((release) => release.sourceItemId));
  const oldestFetchedTimestamp = Math.min(...posts.map((post) => post.created_utc * 1000));
  const oldestFetchedDate = new Date(oldestFetchedTimestamp);

  const missingRecentReleases = await prisma.release.findMany({
    where: {
      source: "REDDIT",
      publishedAt: {
        gte: oldestFetchedDate,
      },
    },
    select: {
      id: true,
      sourceItemId: true,
    },
  });

  const removableIds = missingRecentReleases
    .filter((release) => !retainedIds.has(release.sourceItemId))
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

  const deleted = await prisma.release.deleteMany({
    where: {
      id: {
        in: removableIds,
      },
    },
  });

  return deleted.count;
}

function resolvePreferredGenre(input: {
  currentGenre: string | null;
  fallbackGenre: string | null;
  artistGenreHint?: string | null;
  release: NormalizedReleaseRecord;
  sourceMetadata?: {
    sourceTitle?: string | null;
    sourceExcerpt?: string | null;
    labelName?: string | null;
  } | null;
}) {
  const specificStoredGenre = input.currentGenre?.trim();
  const specificFallbackGenre = input.fallbackGenre?.trim();
  const artistGenreHint = input.artistGenreHint?.trim();
  const synthesizedGenre = buildGenreProfile({
    explicitGenres: [input.currentGenre, input.fallbackGenre, artistGenreHint],
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

  return (
    pickPreferredGenreProfile(
      synthesizedGenre,
      specificFallbackGenre && isSpecificGenreProfile(specificFallbackGenre)
        ? specificFallbackGenre
        : null,
      artistGenreHint && isSpecificGenreProfile(artistGenreHint) ? artistGenreHint : null,
      specificStoredGenre && isSpecificGenreProfile(specificStoredGenre)
        ? specificStoredGenre
        : null,
    ) || null
  );
}

async function loadArtistGenreHints(releases: NormalizedReleaseRecord[]) {
  const targetArtistKeys = new Set(
    releases
      .map((release) => normalizeArtistKey(release.artistName))
      .filter((value): value is string => Boolean(value)),
  );

  if (targetArtistKeys.size === 0) {
    return new Map<string, string>();
  }

  const recentGenreRows = await prisma.release.findMany({
    where: {
      artistName: {
        not: null,
      },
      genreName: {
        not: null,
      },
    },
    select: {
      artistName: true,
      genreName: true,
      publishedAt: true,
    },
    orderBy: {
      publishedAt: "desc",
    },
    take: 700,
  });

  const artistGenreBuckets = new Map<string, string[]>();

  for (const row of recentGenreRows) {
    const artistKey = normalizeArtistKey(row.artistName);
    if (!artistKey || !targetArtistKeys.has(artistKey) || !row.genreName) {
      continue;
    }

    if (!isSpecificGenreProfile(row.genreName)) {
      continue;
    }

    const bucket = artistGenreBuckets.get(artistKey) || [];
    if (bucket.length >= 4) {
      continue;
    }

    bucket.push(row.genreName);
    artistGenreBuckets.set(artistKey, bucket);
  }

  const artistGenreHints = new Map<string, string>();
  for (const [artistKey, genres] of artistGenreBuckets.entries()) {
    const hint = pickPreferredGenreProfile(...genres);
    if (hint) {
      artistGenreHints.set(artistKey, hint);
    }
  }

  return artistGenreHints;
}

async function resolveSupplementalBandcampMetadata(release: NormalizedReleaseRecord) {
  const bandcampResult = await searchBandcampRelease({
    artistName: release.artistName,
    projectTitle: release.projectTitle,
    title: release.title,
    releaseType: release.releaseType,
  }).catch(() => null);

  if (!bandcampResult?.url || bandcampResult.url === release.sourceUrl) {
    return null;
  }

  return resolveSourceMetadata(bandcampResult.url, {
    artistName: release.artistName,
    projectTitle: release.projectTitle,
    title: release.title,
  });
}

function mergeSourceMetadataHints(
  primary:
      | {
        sourceTitle?: string | null;
        sourceExcerpt?: string | null;
        genreName?: string | null;
        labelName?: string | null;
        releaseDate?: Date | null;
        sourceImageUrl?: string | null;
        youtubeUrl?: string | null;
        youtubeMusicUrl?: string | null;
        bandcampUrl?: string | null;
        officialWebsiteUrl?: string | null;
        officialStoreUrl?: string | null;
      }
    | null
    | undefined,
  fallback:
      | {
        sourceTitle?: string | null;
        sourceExcerpt?: string | null;
        genreName?: string | null;
        labelName?: string | null;
        releaseDate?: Date | null;
        sourceImageUrl?: string | null;
        youtubeUrl?: string | null;
        youtubeMusicUrl?: string | null;
        bandcampUrl?: string | null;
        officialWebsiteUrl?: string | null;
        officialStoreUrl?: string | null;
      }
    | null
    | undefined,
) {
  if (!primary && !fallback) {
    return null;
  }

  return {
    sourceTitle: primary?.sourceTitle || fallback?.sourceTitle || null,
    sourceExcerpt: primary?.sourceExcerpt || fallback?.sourceExcerpt || null,
    genreName:
      pickPreferredGenreProfile(primary?.genreName || null, fallback?.genreName || null) || null,
    labelName: primary?.labelName || fallback?.labelName || null,
    releaseDate: primary?.releaseDate || fallback?.releaseDate || null,
    sourceImageUrl: primary?.sourceImageUrl || fallback?.sourceImageUrl || null,
    youtubeUrl: primary?.youtubeUrl || fallback?.youtubeUrl || null,
    youtubeMusicUrl: primary?.youtubeMusicUrl || fallback?.youtubeMusicUrl || null,
    bandcampUrl: primary?.bandcampUrl || fallback?.bandcampUrl || null,
    officialWebsiteUrl: primary?.officialWebsiteUrl || fallback?.officialWebsiteUrl || null,
    officialStoreUrl: primary?.officialStoreUrl || fallback?.officialStoreUrl || null,
  };
}

function normalizeArtistKey(value: string | null | undefined) {
  return value
    ?.toLowerCase()
    .normalize("NFKD")
    .replace(/\s+/g, " ")
    .trim() || "";
}

function isPurchasableReleaseType(releaseType: ReleaseType) {
  return (
    releaseType === ReleaseType.SINGLE ||
    releaseType === ReleaseType.ALBUM ||
    releaseType === ReleaseType.EP
  );
}
