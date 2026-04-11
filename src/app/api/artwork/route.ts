import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { resolveSourceMetadata } from "@/lib/source-metadata";

export const dynamic = "force-dynamic";

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
        imageUrl: true,
        thumbnailUrl: true,
        sourceUrl: true,
        bandcampUrl: true,
        officialWebsiteUrl: true,
        officialStoreUrl: true,
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
      enqueueSourceCandidate(lookupQueue, visitedSources, metadata?.bandcampUrl || null);
      enqueueSourceCandidate(lookupQueue, visitedSources, metadata?.officialStoreUrl || null);
      enqueueSourceCandidate(lookupQueue, visitedSources, metadata?.officialWebsiteUrl || null);
    }

    return {
      candidates: [...candidates],
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

    return parsed.toString();
  } catch {
    return null;
  }
}
