import { revalidateTag, unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import { buildArtworkProxyUrl } from "@/lib/artwork-fallback";
import { ensureDatabase } from "@/lib/database";
import { getGenreOverride } from "@/lib/genre-overrides";
import { resolveGenreDecision } from "@/lib/genre-resolution";
import { clearReleaseDataCaches } from "@/lib/release-sections";
import { assessReleaseQuality } from "@/lib/release-quality";
import { prisma } from "@/lib/prisma";
import { fetchPublicHttpUrl, normalizePublicHttpUrl } from "@/lib/safe-url";
import { getSiteUrl } from "@/lib/site";
import { resolveSourceMetadata } from "@/lib/source-metadata";
import { shouldRefreshYouTubeMetadata } from "@/lib/youtube-metadata";

const ARTWORK_PROXY_REVALIDATE_SECONDS = 60 * 60;
const ARTWORK_PROXY_CACHE_CONTROL = "public, max-age=3600, stale-while-revalidate=86400";
const ARTWORK_FETCH_USER_AGENT =
  process.env.SOURCE_FETCH_USER_AGENT ||
  `MooSQA/0.4 (${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"})`;
const MAX_ARTWORK_SOURCE_LOOKUPS = 6;

export async function GET(request: Request) {
  await ensureDatabase();
  const { searchParams } = new URL(request.url);
  const releaseId = searchParams.get("releaseId")?.trim() || "";

  if (!releaseId) {
    return NextResponse.json({ error: "Missing releaseId" }, { status: 400 });
  }

  const artworkPayload = await getCachedArtworkPayload(releaseId);

  if (!artworkPayload) {
    return NextResponse.json({ error: "Release not found" }, { status: 404 });
  }

  for (const candidateUrl of artworkPayload.candidates) {
    const imageResponse = await fetchArtworkCandidate(candidateUrl);
    if (!imageResponse) {
      continue;
    }

    await persistResolvedArtworkCandidate(artworkPayload, candidateUrl);

    return new Response(imageResponse.body, {
      headers: {
        "Cache-Control": ARTWORK_PROXY_CACHE_CONTROL,
        "Content-Disposition": "inline",
        "Content-Type": imageResponse.contentType,
      },
    });
  }

  return NextResponse.json({ error: "Artwork unavailable" }, { status: 404 });
}

const getCachedArtworkPayload = unstable_cache(
  async (releaseId: string) => {
    const release = await prisma.release.findUnique({
      where: { id: releaseId },
      select: {
        id: true,
        title: true,
        artistName: true,
        projectTitle: true,
        releaseType: true,
        imageUrl: true,
        thumbnailUrl: true,
        sourceUrl: true,
        youtubeUrl: true,
        youtubeMusicUrl: true,
        youtubeViewCount: true,
        youtubePublishedAt: true,
        youtubeMetadataUpdatedAt: true,
        bandcampUrl: true,
        officialWebsiteUrl: true,
        officialStoreUrl: true,
        genreName: true,
        labelName: true,
        summary: true,
        aiSummary: true,
        summarySourceTitle: true,
        summarySourceExcerpt: true,
        releaseDate: true,
        publishedAt: true,
        metadataEnrichedAt: true,
        qualityCheckedAt: true,
        genreConfidence: true,
      },
    });

    if (!release) {
      return null;
    }

    const candidates = new Set<string>();
    pushCandidate(candidates, release.imageUrl);
    pushCandidate(candidates, release.thumbnailUrl);

    const lookupQueue = [
      release.bandcampUrl,
      release.officialStoreUrl,
      release.officialWebsiteUrl,
      release.sourceUrl,
    ]
      .map(normalizeUrl)
      .filter((value): value is string => Boolean(value));
    const visitedSources = new Set<string>();
    let discoveredBandcampUrl = release.bandcampUrl || null;
    let discoveredYoutubeUrl = release.youtubeUrl || null;
    let discoveredYoutubeMusicUrl = release.youtubeMusicUrl || null;
    let discoveredYoutubeViewCount = release.youtubeViewCount || null;
    let discoveredYouTubePublishedAt = release.youtubePublishedAt || null;
    let discoveredOfficialWebsiteUrl = release.officialWebsiteUrl || null;
    let discoveredOfficialStoreUrl = release.officialStoreUrl || null;
    let discoveredReleaseDate = release.releaseDate || null;
    let discoveredLabelName = release.labelName || null;
    const discoveredGenreCandidates = new Set<string>();
    const discoveredSourceTitles = new Set<string>();
    const discoveredSourceExcerpts = new Set<string>();

    while (lookupQueue.length > 0 && visitedSources.size < MAX_ARTWORK_SOURCE_LOOKUPS) {
      const sourceUrl = lookupQueue.shift();
      if (!sourceUrl || visitedSources.has(sourceUrl)) {
        continue;
      }

      visitedSources.add(sourceUrl);

      const metadata = await resolveSourceMetadata(sourceUrl, {
        artistName: release.artistName,
        projectTitle: release.projectTitle,
        title: release.title,
      }).catch(() => null);

      pushCandidate(candidates, metadata?.sourceImageUrl || null);
      pushTextCandidate(discoveredSourceTitles, metadata?.sourceTitle || null);
      pushTextCandidate(discoveredSourceExcerpts, metadata?.sourceExcerpt || null);
      pushTextCandidate(discoveredGenreCandidates, metadata?.genreName || null);
      discoveredBandcampUrl = discoveredBandcampUrl || normalizeUrl(metadata?.bandcampUrl || null);
      discoveredYoutubeUrl = discoveredYoutubeUrl || normalizeUrl(metadata?.youtubeUrl || null);
      discoveredYoutubeMusicUrl =
        discoveredYoutubeMusicUrl || normalizeUrl(metadata?.youtubeMusicUrl || null);
      discoveredYoutubeViewCount = discoveredYoutubeViewCount || metadata?.youtubeViewCount || null;
      discoveredYouTubePublishedAt =
        discoveredYouTubePublishedAt || metadata?.youtubePublishedAt || null;
      discoveredOfficialWebsiteUrl =
        discoveredOfficialWebsiteUrl || normalizeUrl(metadata?.officialWebsiteUrl || null);
      discoveredOfficialStoreUrl =
        discoveredOfficialStoreUrl || normalizeUrl(metadata?.officialStoreUrl || null);
      discoveredReleaseDate = discoveredReleaseDate || metadata?.releaseDate || null;
      discoveredLabelName = discoveredLabelName || normalizeLabel(metadata?.labelName || null);
      enqueueSourceCandidate(lookupQueue, visitedSources, metadata?.bandcampUrl || null);
      enqueueSourceCandidate(lookupQueue, visitedSources, metadata?.youtubeUrl || null);
      enqueueSourceCandidate(lookupQueue, visitedSources, metadata?.youtubeMusicUrl || null);
      enqueueSourceCandidate(lookupQueue, visitedSources, metadata?.officialStoreUrl || null);
      enqueueSourceCandidate(lookupQueue, visitedSources, metadata?.officialWebsiteUrl || null);
    }

    return {
      release,
      candidates: [...candidates],
      discoveredBandcampUrl,
      discoveredYoutubeUrl,
      discoveredYoutubeMusicUrl,
      discoveredYoutubeViewCount,
      discoveredYouTubePublishedAt,
      discoveredOfficialWebsiteUrl,
      discoveredOfficialStoreUrl,
      discoveredReleaseDate,
      discoveredLabelName,
      discoveredGenreCandidates: [...discoveredGenreCandidates],
      discoveredSourceTitles: [...discoveredSourceTitles],
      discoveredSourceExcerpts: [...discoveredSourceExcerpts],
    };
  },
  ["release-artwork-proxy"],
  {
    revalidate: ARTWORK_PROXY_REVALIDATE_SECONDS,
    tags: ["releases", "release-artwork"],
  },
);

async function fetchArtworkCandidate(url: string) {
  try {
    const response = await fetchPublicHttpUrl(url, {
      headers: {
        "User-Agent": ARTWORK_FETCH_USER_AGENT,
      },
      cache: "no-store",
    });

    if (!response?.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return null;
    }

    const body = await response.arrayBuffer();
    if (body.byteLength === 0) {
      return null;
    }

    return {
      body,
      contentType,
    };
  } catch {
    return null;
  }
}

async function persistResolvedArtworkCandidate(
  artworkPayload: NonNullable<Awaited<ReturnType<typeof getCachedArtworkPayload>>>,
  candidateUrl: string,
) {
  const normalizedCandidateUrl = normalizeUrl(candidateUrl);
  const proxyUrl = buildPersistentArtworkProxyUrl(artworkPayload.release.id);
  if (!normalizedCandidateUrl || !proxyUrl) {
    return;
  }

  const nextImageUrl = proxyUrl;
  const nextThumbnailUrl = normalizedCandidateUrl;
  const nextGenreDecision = buildPersistedGenreDecision(artworkPayload);
  const nextGenreName = nextGenreDecision.genre;
  const nextReleaseDate = artworkPayload.discoveredReleaseDate || artworkPayload.release.releaseDate;
  const nextLabelName = artworkPayload.discoveredLabelName || artworkPayload.release.labelName;
  const nextYoutubeUrl = artworkPayload.discoveredYoutubeUrl || artworkPayload.release.youtubeUrl;
  const nextYoutubeMusicUrl =
    artworkPayload.discoveredYoutubeMusicUrl || artworkPayload.release.youtubeMusicUrl;
  const nextYoutubeViewCount =
    artworkPayload.discoveredYoutubeViewCount || artworkPayload.release.youtubeViewCount;
  const nextYouTubePublishedAt =
    artworkPayload.discoveredYouTubePublishedAt || artworkPayload.release.youtubePublishedAt;
  const youtubeMetadataChanged =
    nextYoutubeViewCount !== artworkPayload.release.youtubeViewCount ||
    !datesEqual(nextYouTubePublishedAt, artworkPayload.release.youtubePublishedAt);
  const shouldStampYouTubeMetadataRefresh = shouldRefreshYouTubeMetadata({
    sourceUrl: artworkPayload.release.sourceUrl,
    youtubeUrl: nextYoutubeUrl,
    youtubeMusicUrl: nextYoutubeMusicUrl,
    youtubeViewCount: nextYoutubeViewCount,
    youtubePublishedAt: nextYouTubePublishedAt,
    youtubeMetadataUpdatedAt: artworkPayload.release.youtubeMetadataUpdatedAt,
    metadataEnrichedAt: artworkPayload.release.metadataEnrichedAt,
  }) || youtubeMetadataChanged;
  const nextYouTubeMetadataUpdatedAt = shouldStampYouTubeMetadataRefresh
    ? new Date()
    : artworkPayload.release.youtubeMetadataUpdatedAt;
  const nextBandcampUrl = artworkPayload.discoveredBandcampUrl || artworkPayload.release.bandcampUrl;
  const nextOfficialWebsiteUrl =
    artworkPayload.discoveredOfficialWebsiteUrl || artworkPayload.release.officialWebsiteUrl;
  const nextOfficialStoreUrl =
    artworkPayload.discoveredOfficialStoreUrl || artworkPayload.release.officialStoreUrl;
  const nextSummarySourceTitle =
    artworkPayload.discoveredSourceTitles[0] || artworkPayload.release.summarySourceTitle || artworkPayload.release.projectTitle || artworkPayload.release.title;
  const nextSummarySourceExcerpt =
    artworkPayload.discoveredSourceExcerpts[0] || artworkPayload.release.summarySourceExcerpt || artworkPayload.release.summary || null;
  const hasChanges =
    artworkPayload.release.imageUrl !== nextImageUrl ||
    artworkPayload.release.thumbnailUrl !== nextThumbnailUrl ||
    nextGenreName !== artworkPayload.release.genreName ||
    !datesEqual(nextReleaseDate, artworkPayload.release.releaseDate) ||
    nextLabelName !== artworkPayload.release.labelName ||
    nextYoutubeUrl !== artworkPayload.release.youtubeUrl ||
    nextYoutubeMusicUrl !== artworkPayload.release.youtubeMusicUrl ||
    nextYoutubeViewCount !== artworkPayload.release.youtubeViewCount ||
    !datesEqual(nextYouTubePublishedAt, artworkPayload.release.youtubePublishedAt) ||
    !datesEqual(nextYouTubeMetadataUpdatedAt, artworkPayload.release.youtubeMetadataUpdatedAt) ||
    nextBandcampUrl !== artworkPayload.release.bandcampUrl ||
    nextOfficialWebsiteUrl !== artworkPayload.release.officialWebsiteUrl ||
    nextOfficialStoreUrl !== artworkPayload.release.officialStoreUrl ||
    nextSummarySourceTitle !== artworkPayload.release.summarySourceTitle ||
    nextSummarySourceExcerpt !== artworkPayload.release.summarySourceExcerpt ||
    nextGenreDecision.confidence !== artworkPayload.release.genreConfidence;

  if (!hasChanges) {
    return;
  }

  const checkedAt = new Date();
  const qualitySnapshot = assessReleaseQuality({
    releaseType: artworkPayload.release.releaseType,
    genreName: nextGenreName,
    imageUrl: nextImageUrl,
    thumbnailUrl: nextThumbnailUrl,
    youtubeUrl: nextYoutubeUrl,
    youtubeMusicUrl: nextYoutubeMusicUrl,
    bandcampUrl: nextBandcampUrl,
    officialWebsiteUrl: nextOfficialWebsiteUrl,
      officialStoreUrl: nextOfficialStoreUrl,
      releaseDate: nextReleaseDate,
      publishedAt: artworkPayload.release.publishedAt,
      metadataEnrichedAt: checkedAt,
      qualityCheckedAt: checkedAt,
      genreConfidence: nextGenreDecision.confidence,
    });

  await prisma.release.update({
    where: { id: artworkPayload.release.id },
    data: {
      imageUrl: nextImageUrl,
      thumbnailUrl: nextThumbnailUrl,
      genreName: nextGenreName,
      labelName: nextLabelName,
      releaseDate: nextReleaseDate,
      youtubeUrl: nextYoutubeUrl,
      youtubeMusicUrl: nextYoutubeMusicUrl,
      youtubeViewCount: nextYoutubeViewCount,
      youtubePublishedAt: nextYouTubePublishedAt,
      youtubeMetadataUpdatedAt: nextYouTubeMetadataUpdatedAt,
      bandcampUrl: nextBandcampUrl,
      officialWebsiteUrl: nextOfficialWebsiteUrl,
      officialStoreUrl: nextOfficialStoreUrl,
      genreConfidence: nextGenreDecision.confidence,
      summarySourceTitle: nextSummarySourceTitle,
      summarySourceExcerpt: nextSummarySourceExcerpt,
      artworkStatus: qualitySnapshot.artworkStatus,
      genreStatus: qualitySnapshot.genreStatus,
      linkStatus: qualitySnapshot.linkStatus,
      qualityScore: qualitySnapshot.qualityScore,
      metadataEnrichedAt: checkedAt,
      qualityCheckedAt: checkedAt,
    },
  });

  clearReleaseDataCaches();
  revalidateTag("releases", "max");
}

function pushCandidate(candidates: Set<string>, value: string | null | undefined) {
  const normalizedValue = normalizeUrl(value);
  if (!normalizedValue) {
    return;
  }

  candidates.add(normalizedValue);
}

function pushTextCandidate(candidates: Set<string>, value: string | null | undefined) {
  const normalizedValue = value?.trim() || "";
  if (!normalizedValue) {
    return;
  }

  candidates.add(normalizedValue);
}

function enqueueSourceCandidate(
  queue: string[],
  visitedSources: Set<string>,
  value: string | null | undefined,
) {
  const normalizedValue = normalizeUrl(value);
  if (!normalizedValue || visitedSources.has(normalizedValue) || queue.includes(normalizedValue)) {
    return;
  }

  queue.push(normalizedValue);
}

function normalizeUrl(value: string | null | undefined) {
  const normalized = value?.trim() || "";
  if (!normalized) {
    return null;
  }

  try {
    const publicUrl = normalizePublicHttpUrl(normalized);
    if (!publicUrl) {
      return null;
    }

    const parsed = new URL(publicUrl);
    if (isArtworkProxyUrl(parsed)) {
      return null;
    }

    return publicUrl;
  } catch {
    return null;
  }
}

function normalizeLabel(value: string | null | undefined) {
  const normalized = value?.replace(/\s+/g, " ").trim() || "";
  if (!normalized) {
    return null;
  }

  const lowered = normalized.toLowerCase();
  if (
    lowered.startsWith("http") ||
    lowered.includes("schema.org") ||
    lowered.includes("schema.googleapis.com")
  ) {
    return null;
  }

  return normalized;
}

function buildPersistedGenreDecision(
  artworkPayload: NonNullable<Awaited<ReturnType<typeof getCachedArtworkPayload>>>,
) {
  return resolveGenreDecision({
    releaseType: artworkPayload.release.releaseType,
    currentGenre: artworkPayload.release.genreName,
    explicitGenres: [
      getGenreOverride(artworkPayload.release),
      artworkPayload.release.genreName,
      ...artworkPayload.discoveredGenreCandidates,
    ],
    textSegments: [
      artworkPayload.release.title,
      artworkPayload.release.projectTitle,
      artworkPayload.release.summary,
      artworkPayload.release.aiSummary,
      ...artworkPayload.discoveredSourceTitles,
      ...artworkPayload.discoveredSourceExcerpts,
    ],
    artistName: artworkPayload.release.artistName,
    projectTitle: artworkPayload.release.projectTitle,
    title: artworkPayload.release.title,
    labelName: artworkPayload.discoveredLabelName || artworkPayload.release.labelName || null,
    limit: 3,
  });
}

function datesEqual(left: Date | null | undefined, right: Date | null | undefined) {
  if (left === null && right === null) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.getTime() === right.getTime();
}

function buildPersistentArtworkProxyUrl(releaseId: string) {
  const relativeProxyUrl = buildArtworkProxyUrl(releaseId);
  if (!relativeProxyUrl) {
    return null;
  }

  return new URL(relativeProxyUrl, getSiteUrl()).toString();
}

function isArtworkProxyUrl(parsed: URL) {
  return parsed.pathname === "/api/artwork";
}
