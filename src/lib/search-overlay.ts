import { cacheLife, cacheTag } from "next/cache";

import { ReleaseType } from "@/generated/prisma/enums";
import { ensureDatabase } from "@/lib/database";
import { applyReleaseEditorialFields, buildVisibleReleaseWhere } from "@/lib/editorial";
import { isSpecificGenreProfile } from "@/lib/genre-profile";
import { prisma } from "@/lib/prisma";
import { resolveBestGenreProfile } from "@/lib/genre-resolution";
import { normalizeSearchText } from "@/lib/release-search";

export type SearchOverlayIndexItem = {
  id: string;
  slug: string;
  title: string;
  artistName: string | null;
  projectTitle: string | null;
  releaseType: ReleaseType;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  sourceUrl: string;
  youtubeUrl: string | null;
  youtubeMusicUrl: string | null;
  youtubeViewCount: number | null;
  bandcampUrl: string | null;
  bandcampSupporterCount: number | null;
  bandcampFollowerCount: number | null;
  officialWebsiteUrl: string | null;
  officialStoreUrl: string | null;
  genreName: string | null;
  summary: string | null;
  aiSummary: string | null;
  score: number | null;
  commentCount: number | null;
  publishedAt: string;
};

export type SearchOverlayPayload = {
  generatedAt: string;
  genres: string[];
  results: SearchOverlayIndexItem[];
};

const SEARCH_OVERLAY_GENRE_LIMIT = 120;
const SEARCH_OVERLAY_GENRE_LOOKBACK_DAYS = 365;

const searchOverlaySelect = {
  id: true,
  slug: true,
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
  bandcampUrl: true,
  bandcampSupporterCount: true,
  bandcampFollowerCount: true,
  officialWebsiteUrl: true,
  officialStoreUrl: true,
  genreName: true,
  genreOverride: true,
  summary: true,
  summaryOverride: true,
  imageUrlOverride: true,
  sourceUrlOverride: true,
  aiSummary: true,
  score: true,
  commentCount: true,
  publishedAt: true,
} as const;

export async function getSearchOverlayPayload(): Promise<SearchOverlayPayload> {
  "use cache";

  cacheLife("minutes");
  cacheTag("releases", "search-index", "genre-facets");

  await ensureDatabase();

  const releases = await prisma.release.findMany({
    select: searchOverlaySelect,
    where: buildVisibleReleaseWhere(),
    orderBy: { publishedAt: "desc" },
  });

  const editedReleases = releases.map((release) => applyReleaseEditorialFields(release));
  const results = editedReleases.map((editedRelease) => ({
    id: editedRelease.id,
    slug: editedRelease.slug,
    title: editedRelease.title,
    artistName: editedRelease.artistName,
    projectTitle: editedRelease.projectTitle,
    releaseType: editedRelease.releaseType,
    imageUrl: editedRelease.imageUrl,
    thumbnailUrl: editedRelease.thumbnailUrl,
    sourceUrl: editedRelease.sourceUrl,
    youtubeUrl: editedRelease.youtubeUrl,
    youtubeMusicUrl: editedRelease.youtubeMusicUrl,
    youtubeViewCount: editedRelease.youtubeViewCount,
    bandcampUrl: editedRelease.bandcampUrl,
    bandcampSupporterCount: editedRelease.bandcampSupporterCount,
    bandcampFollowerCount: editedRelease.bandcampFollowerCount,
    officialWebsiteUrl: editedRelease.officialWebsiteUrl,
    officialStoreUrl: editedRelease.officialStoreUrl,
    genreName: editedRelease.genreName,
    summary: editedRelease.summary,
    aiSummary: editedRelease.aiSummary,
    score: editedRelease.score,
    commentCount: editedRelease.commentCount,
    publishedAt: editedRelease.publishedAt.toISOString(),
  }));

  return {
    generatedAt: new Date().toISOString(),
    genres: buildGenreFacets(editedReleases),
    results,
  };
}

export async function getHomepageGenreFilters() {
  const payload = await getSearchOverlayPayload();
  return payload.genres;
}

function buildGenreFacets(
  releases: Array<{
    title: string;
    artistName: string | null;
    projectTitle: string | null;
    releaseType: ReleaseType;
    genreName: string | null;
    summary: string | null;
    aiSummary: string | null;
    publishedAt: Date;
  }>,
) {
  const recentCutoff = Date.now() - SEARCH_OVERLAY_GENRE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const specificGenres = collectGenres(releases, {
    recentCutoff,
    specificOnly: true,
  });

  const fallbackGenres =
    specificGenres.length >= SEARCH_OVERLAY_GENRE_LIMIT
      ? specificGenres
      : collectGenres(releases, {
          recentCutoff,
          specificOnly: false,
        });

  return fallbackGenres.slice(0, SEARCH_OVERLAY_GENRE_LIMIT).map((entry) => entry.label);
}

function collectGenres(
  releases: Array<{
    title: string;
    artistName: string | null;
    projectTitle: string | null;
    releaseType: ReleaseType;
    genreName: string | null;
    summary: string | null;
    aiSummary: string | null;
    publishedAt: Date;
  }>,
  options: {
    recentCutoff: number;
    specificOnly: boolean;
  },
) {
  const genreMap = new Map<
    string,
    {
      label: string;
      count: number;
      latestPublishedAt: number;
      recentCount: number;
      isSpecific: boolean;
    }
  >();

  for (const release of releases) {
    const genreName =
      resolveBestGenreProfile({
        releaseType: release.releaseType,
        currentGenre: release.genreName,
        explicitGenres: [release.genreName],
        textSegments: [
          release.title,
          release.projectTitle,
          release.summary,
          release.aiSummary,
        ],
        artistName: release.artistName,
        projectTitle: release.projectTitle,
        title: release.title,
        limit: 3,
      }) || "";
    if (!genreName) {
      continue;
    }

    const normalizedGenre = normalizeSearchText(genreName);
    if (!normalizedGenre) {
      continue;
    }

    const isSpecific = isSpecificGenreProfile(genreName);
    if (options.specificOnly && !isSpecific) {
      continue;
    }

    const entry = genreMap.get(normalizedGenre) || {
      label: genreName,
      count: 0,
      latestPublishedAt: 0,
      recentCount: 0,
      isSpecific,
    };

    entry.count += 1;
    entry.latestPublishedAt = Math.max(entry.latestPublishedAt, release.publishedAt.getTime());

    if (release.publishedAt.getTime() >= options.recentCutoff) {
      entry.recentCount += 1;
    }

    if (
      isSpecific &&
      (!entry.isSpecific || genreName.length > entry.label.length)
    ) {
      entry.label = genreName;
      entry.isSpecific = true;
    } else if (!entry.label) {
      entry.label = genreName;
    }

    genreMap.set(normalizedGenre, entry);
  }

  return [...genreMap.values()]
    .filter((entry) => entry.recentCount > 0 || entry.count >= 2)
    .sort((left, right) => {
      if (right.recentCount !== left.recentCount) {
        return right.recentCount - left.recentCount;
      }

      if (right.count !== left.count) {
        return right.count - left.count;
      }

      if (right.isSpecific !== left.isSpecific) {
        return Number(right.isSpecific) - Number(left.isSpecific);
      }

      if (right.latestPublishedAt !== left.latestPublishedAt) {
        return right.latestPublishedAt - left.latestPublishedAt;
      }

      return left.label.localeCompare(right.label);
    });
}
