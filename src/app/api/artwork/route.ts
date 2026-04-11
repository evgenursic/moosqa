import { revalidateTag, unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import { buildArtworkProxyUrl } from "@/lib/artwork-fallback";
import { ensureDatabase } from "@/lib/database";
import { clearReleaseDataCaches } from "@/lib/release-sections";
import { assessReleaseQuality } from "@/lib/release-quality";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site";
import { resolveSourceMetadata } from "@/lib/source-metadata";

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
        bandcampUrl: true,
        officialWebsiteUrl: true,
        officialStoreUrl: true,
        genreName: true,
        releaseDate: true,
        publishedAt: true,
        metadataEnrichedAt: true,
        qualityCheckedAt: true,
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
    let discoveredOfficialWebsiteUrl = release.officialWebsiteUrl || null;
    let discoveredOfficialStoreUrl = release.officialStoreUrl || null;

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
      discoveredBandcampUrl = discoveredBandcampUrl || normalizeUrl(metadata?.bandcampUrl || null);
      discoveredOfficialWebsiteUrl =
        discoveredOfficialWebsiteUrl || normalizeUrl(metadata?.officialWebsiteUrl || null);
      discoveredOfficialStoreUrl =
        discoveredOfficialStoreUrl || normalizeUrl(metadata?.officialStoreUrl || null);
      enqueueSourceCandidate(lookupQueue, visitedSources, metadata?.bandcampUrl || null);
      enqueueSourceCandidate(lookupQueue, visitedSources, metadata?.officialStoreUrl || null);
      enqueueSourceCandidate(lookupQueue, visitedSources, metadata?.officialWebsiteUrl || null);
    }

    return {
      release,
      candidates: [...candidates],
      discoveredBandcampUrl,
      discoveredOfficialWebsiteUrl,
      discoveredOfficialStoreUrl,
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
    const response = await fetch(url, {
      headers: {
        "User-Agent": ARTWORK_FETCH_USER_AGENT,
      },
      redirect: "follow",
      cache: "no-store",
    });

    if (!response.ok) {
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
  const hasChanges =
    artworkPayload.release.imageUrl !== nextImageUrl ||
    artworkPayload.release.thumbnailUrl !== nextThumbnailUrl ||
    (artworkPayload.discoveredBandcampUrl &&
      artworkPayload.discoveredBandcampUrl !== artworkPayload.release.bandcampUrl) ||
    (artworkPayload.discoveredOfficialWebsiteUrl &&
      artworkPayload.discoveredOfficialWebsiteUrl !== artworkPayload.release.officialWebsiteUrl) ||
    (artworkPayload.discoveredOfficialStoreUrl &&
      artworkPayload.discoveredOfficialStoreUrl !== artworkPayload.release.officialStoreUrl);

  if (!hasChanges) {
    return;
  }

  const checkedAt = new Date();
  const qualitySnapshot = assessReleaseQuality({
    releaseType: artworkPayload.release.releaseType,
    genreName: artworkPayload.release.genreName,
    imageUrl: nextImageUrl,
    thumbnailUrl: nextThumbnailUrl,
    youtubeUrl: artworkPayload.release.youtubeUrl,
    youtubeMusicUrl: artworkPayload.release.youtubeMusicUrl,
    bandcampUrl: artworkPayload.discoveredBandcampUrl || artworkPayload.release.bandcampUrl,
    officialWebsiteUrl:
      artworkPayload.discoveredOfficialWebsiteUrl || artworkPayload.release.officialWebsiteUrl,
    officialStoreUrl:
      artworkPayload.discoveredOfficialStoreUrl || artworkPayload.release.officialStoreUrl,
    releaseDate: artworkPayload.release.releaseDate,
    publishedAt: artworkPayload.release.publishedAt,
    metadataEnrichedAt: artworkPayload.release.metadataEnrichedAt,
    qualityCheckedAt: checkedAt,
  });

  await prisma.release.update({
    where: { id: artworkPayload.release.id },
    data: {
      imageUrl: nextImageUrl,
      thumbnailUrl: nextThumbnailUrl,
      bandcampUrl: artworkPayload.discoveredBandcampUrl || artworkPayload.release.bandcampUrl,
      officialWebsiteUrl:
        artworkPayload.discoveredOfficialWebsiteUrl || artworkPayload.release.officialWebsiteUrl,
      officialStoreUrl:
        artworkPayload.discoveredOfficialStoreUrl || artworkPayload.release.officialStoreUrl,
      artworkStatus: qualitySnapshot.artworkStatus,
      linkStatus: qualitySnapshot.linkStatus,
      qualityScore: qualitySnapshot.qualityScore,
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
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    if (isArtworkProxyUrl(parsed)) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
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
