import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";

import { ensureDatabase } from "@/lib/database";
import { applyReleaseEditorialFields } from "@/lib/editorial";
import { prisma } from "@/lib/prisma";
import { getSearchGenreFacets } from "@/lib/release-sections";
import { getSiteUrl } from "@/lib/site";
import {
  buildCollectionSitemapEntry,
  buildReleaseSitemapEntry,
  buildStaticSitemapEntries,
  buildTrendingGenreSitemapEntries,
  SITEMAP_RELEASE_LIMIT,
} from "@/lib/sitemap";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return getCachedSitemap();
}

const getCachedSitemap = unstable_cache(
  async (): Promise<MetadataRoute.Sitemap> => buildSitemap(),
  ["sitemap"],
  {
    revalidate: 3_600,
    tags: ["releases", "editorial", "genre-facets", "sitemap"],
  },
);

async function buildSitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const generatedAt = new Date();
  const staticEntries = buildStaticSitemapEntries(siteUrl, generatedAt);
  let releaseEntries: MetadataRoute.Sitemap = [];
  let genreEntries: MetadataRoute.Sitemap = [];
  let collectionEntries: MetadataRoute.Sitemap = [];

  try {
    await ensureDatabase();

    const releases = await prisma.release.findMany({
      where: {
        isHidden: false,
      },
      select: {
        slug: true,
        updatedAt: true,
        publishedAt: true,
        imageUrl: true,
        thumbnailUrl: true,
        imageUrlOverride: true,
      },
      orderBy: {
        publishedAt: "desc",
      },
      take: SITEMAP_RELEASE_LIMIT,
    });

    releaseEntries = releases.map((release) =>
      buildReleaseSitemapEntry(siteUrl, applyReleaseEditorialFields(release)),
    );

    const collections = await prisma.editorialCollection.findMany({
      where: {
        isPublished: true,
        publishedAt: {
          not: null,
        },
        entries: {
          some: {
            release: {
              isHidden: false,
            },
          },
        },
      },
      select: {
        slug: true,
        updatedAt: true,
        publishedAt: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 120,
    });

    collectionEntries = collections.map((collection) => buildCollectionSitemapEntry(siteUrl, collection));
  } catch (error) {
    console.error("Release sitemap entries failed to load.", error);
  }

  try {
    const genres = await getSearchGenreFacets({ useCache: false });
    genreEntries = buildTrendingGenreSitemapEntries(siteUrl, genres.slice(0, 48), generatedAt);
  } catch (error) {
    console.error("Trending genre sitemap entries failed to load.", error);
  }

  return [...staticEntries, ...genreEntries, ...collectionEntries, ...releaseEntries];
}
