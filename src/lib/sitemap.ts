import type { MetadataRoute } from "next";

import {
  buildArchiveHref,
  buildPlatformArchiveHref,
  buildSceneArchiveHref,
  buildSignalArchiveHref,
  buildTrendingGenreHref,
  type PlatformArchiveSlug,
  type SignalArchiveSlug,
  type SignalArchiveTimeframe,
} from "@/lib/archive-links";
import { SCENE_DISCOVERY_RULES } from "@/lib/discovery-scenes";
import { releaseSectionDefinitions } from "@/lib/release-sections";

export const SITEMAP_RELEASE_LIMIT = 2000;

type SitemapRelease = {
  slug: string;
  updatedAt: Date;
  publishedAt: Date;
  imageUrl: string | null;
  thumbnailUrl: string | null;
};

const PLATFORM_ARCHIVE_SLUGS: PlatformArchiveSlug[] = [
  "bandcamp",
  "youtube",
  "youtube-music",
];
const SIGNAL_ARCHIVE_DEFAULTS: Array<{
  signal: SignalArchiveSlug;
  timeframe: SignalArchiveTimeframe;
}> = [
  { signal: "opened", timeframe: "today" },
  { signal: "shared", timeframe: "7d" },
  { signal: "listened", timeframe: "7d" },
  { signal: "liked", timeframe: "7d" },
  { signal: "disliked", timeframe: "7d" },
  { signal: "discussed", timeframe: "7d" },
];

export function buildStaticSitemapEntries(
  siteUrl: string,
  lastModified: Date,
): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified,
      changeFrequency: "hourly",
      priority: 1,
    },
  ];

  for (const section of Object.keys(releaseSectionDefinitions)) {
    entries.push({
      url: absoluteUrl(siteUrl, buildArchiveHref(section)),
      lastModified,
      changeFrequency: "hourly",
      priority: section === "latest" ? 0.95 : 0.85,
    });

    entries.push({
      url: absoluteUrl(siteUrl, buildArchiveHref(section, { view: "trending" })),
      lastModified,
      changeFrequency: "hourly",
      priority: section === "top-engaged" ? 0.9 : 0.75,
    });
  }

  for (const platform of PLATFORM_ARCHIVE_SLUGS) {
    entries.push({
      url: absoluteUrl(siteUrl, buildPlatformArchiveHref(platform)),
      lastModified,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  for (const { signal, timeframe } of SIGNAL_ARCHIVE_DEFAULTS) {
    entries.push({
      url: absoluteUrl(siteUrl, buildSignalArchiveHref(signal, undefined, timeframe)),
      lastModified,
      changeFrequency: "hourly",
      priority: 0.72,
    });
  }

  for (const scene of SCENE_DISCOVERY_RULES) {
    entries.push({
      url: absoluteUrl(siteUrl, buildSceneArchiveHref(scene.slug)),
      lastModified,
      changeFrequency: "daily",
      priority: 0.68,
    });
  }

  return dedupeSitemapEntries(entries);
}

export function buildTrendingGenreSitemapEntries(
  siteUrl: string,
  genres: string[],
  lastModified: Date,
): MetadataRoute.Sitemap {
  const entries = genres
    .map((genre) => absoluteUrl(siteUrl, buildTrendingGenreHref(genre)))
    .filter((url, index, urls) => urls.indexOf(url) === index)
    .map((url) => ({
      url,
      lastModified,
      changeFrequency: "daily" as const,
      priority: 0.66,
    }));

  return entries;
}

export function buildReleaseSitemapEntry(
  siteUrl: string,
  release: SitemapRelease,
): MetadataRoute.Sitemap[number] {
  const imageUrl = getSitemapImageUrl(release.imageUrl || release.thumbnailUrl);

  return {
    url: absoluteUrl(siteUrl, `/releases/${release.slug}`),
    lastModified: release.updatedAt || release.publishedAt,
    changeFrequency: "daily",
    priority: 0.7,
    images: imageUrl ? [imageUrl] : undefined,
  };
}

function absoluteUrl(siteUrl: string, path: string) {
  return new URL(path, siteUrl).toString();
}

function getSitemapImageUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function dedupeSitemapEntries(entries: MetadataRoute.Sitemap) {
  const seen = new Set<string>();

  return entries.filter((entry) => {
    if (seen.has(entry.url)) {
      return false;
    }

    seen.add(entry.url);
    return true;
  });
}
