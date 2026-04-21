import type { MetadataRoute } from "next";

import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getSearchGenreFacets } from "@/lib/release-sections";
import { getSiteUrl } from "@/lib/site";
import {
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

  try {
    await ensureDatabase();

    const releases = await prisma.release.findMany({
      select: {
        slug: true,
        updatedAt: true,
        publishedAt: true,
        imageUrl: true,
        thumbnailUrl: true,
      },
      orderBy: {
        publishedAt: "desc",
      },
      take: SITEMAP_RELEASE_LIMIT,
    });

    releaseEntries = releases.map((release) => buildReleaseSitemapEntry(siteUrl, release));
  } catch (error) {
    console.error("Release sitemap entries failed to load.", error);
  }

  try {
    const genres = await getSearchGenreFacets({ useCache: false });
    genreEntries = buildTrendingGenreSitemapEntries(siteUrl, genres.slice(0, 48), generatedAt);
  } catch (error) {
    console.error("Trending genre sitemap entries failed to load.", error);
  }

  return [...staticEntries, ...genreEntries, ...releaseEntries];
}
