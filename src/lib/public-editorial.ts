import { unstable_cache } from "next/cache";

import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getReleaseListingItemsByIds, type ReleaseListingItem } from "@/lib/release-sections";

export async function getPublicEditorialHubData() {
  await ensureDatabase();
  return getCachedPublicEditorialHubData();
}

export async function getPublicEditorialCollection(slug: string) {
  await ensureDatabase();
  return getCachedPublicEditorialCollection(slug);
}

const getCachedPublicEditorialHubData = unstable_cache(
  async () => {
    const [featuredRows, collections] = await Promise.all([
      prisma.release.findMany({
        where: {
          isHidden: false,
          isFeatured: true,
        },
        orderBy: [{ editorialRank: "desc" }, { featuredAt: "desc" }, { publishedAt: "desc" }],
        take: 6,
        select: {
          id: true,
        },
      }),
      prisma.editorialCollection.findMany({
        where: {
          isPublished: true,
        },
        orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
        take: 8,
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          type: true,
          publishedAt: true,
          entries: {
            orderBy: [{ position: "asc" }, { createdAt: "asc" }],
            take: 4,
            select: {
              releaseId: true,
            },
          },
        },
      }),
    ]);

    const featuredIds = featuredRows.map((entry) => entry.id);
    const collectionReleaseIds = [...new Set(collections.flatMap((collection) => collection.entries.map((entry) => entry.releaseId)))];
    const [featuredReleases, collectionReleases] = await Promise.all([
      getReleaseListingItemsByIds(featuredIds),
      getReleaseListingItemsByIds(collectionReleaseIds),
    ]);

    const featuredById = new Map(featuredReleases.map((release) => [release.id, release]));
    const collectionReleaseById = new Map(collectionReleases.map((release) => [release.id, release]));

    const publicCollections = collections
      .map((collection) => ({
        ...collection,
        entries: collection.entries
          .map((entry) => collectionReleaseById.get(entry.releaseId) || null)
          .filter((release): release is ReleaseListingItem => Boolean(release)),
      }))
      .filter((collection) => Boolean(collection.publishedAt) && collection.entries.length > 0);

    return {
      featuredReleases: featuredIds
        .map((releaseId) => featuredById.get(releaseId) || null)
        .filter((release): release is ReleaseListingItem => Boolean(release)),
      collections: publicCollections,
    };
  },
  ["public-editorial-hub"],
  {
    revalidate: 300,
    tags: ["releases", "editorial"],
  },
);

const getCachedPublicEditorialCollection = unstable_cache(
  async (slug: string) => {
    const collection = await prisma.editorialCollection.findFirst({
      where: {
        slug,
        isPublished: true,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        type: true,
        publishedAt: true,
        entries: {
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            position: true,
            note: true,
            releaseId: true,
          },
        },
      },
    });

    if (!collection) {
      return null;
    }

    const releases = await getReleaseListingItemsByIds(collection.entries.map((entry) => entry.releaseId));
    const releaseById = new Map(releases.map((release) => [release.id, release]));
    const visibleEntries = collection.entries
      .map((entry) => ({
        ...entry,
        release: releaseById.get(entry.releaseId) || null,
      }))
      .filter((entry): entry is typeof entry & { release: ReleaseListingItem } => Boolean(entry.release));

    if (!collection.publishedAt || visibleEntries.length === 0) {
      return null;
    }

    return {
      ...collection,
      entries: visibleEntries,
    };
  },
  ["public-editorial-collection"],
  {
    revalidate: 300,
    tags: ["releases", "editorial"],
  },
);
