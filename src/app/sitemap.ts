import type { MetadataRoute } from "next";

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
