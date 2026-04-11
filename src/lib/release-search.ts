import { ReleaseType } from "@/generated/prisma/enums";
import { detectPlatform } from "@/lib/listening-links";

export type SearchableReleaseListing = {
  id: string;
  slug: string;
  title: string;
  artistName: string | null;
  projectTitle: string | null;
  releaseType: ReleaseType;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  outletName?: string | null;
  sourceUrl: string;
  youtubeUrl?: string | null;
  youtubeMusicUrl?: string | null;
  bandcampUrl?: string | null;
  officialWebsiteUrl?: string | null;
  officialStoreUrl?: string | null;
  labelName?: string | null;
  genreName?: string | null;
  summary?: string | null;
  aiSummary?: string | null;
  publishedAt: Date | string;
};

export type ReleaseSearchFilters = {
  query?: string;
  type?: string;
  genre?: string;
  platform?: string;
  directOnly?: boolean;
};

export function filterAndRankReleaseListings<T extends SearchableReleaseListing>(
  releases: T[],
  filters: ReleaseSearchFilters,
) {
  const normalizedQuery = normalizeSearchText(filters.query || "");
  const typeValue = filters.type || "";
  const genreValue = normalizeSearchText(filters.genre || "");
  const platformValue = filters.platform || "";
  const directOnly = Boolean(filters.directOnly);

  return releases
    .map((release) => ({
      release,
      score: getSearchScore(release, normalizedQuery),
    }))
    .filter(({ release, score }) => {
      if (normalizedQuery.length > 0 && score <= 0) {
        return false;
      }

      if (typeValue && release.releaseType !== typeValue) {
        return false;
      }

      if (genreValue) {
        const releaseGenre = normalizeSearchText(release.genreName || "");
        if (!releaseGenre || (releaseGenre !== genreValue && !releaseGenre.includes(genreValue))) {
          return false;
        }
      }

      if (platformValue && getReleasePlatform(release) !== platformValue) {
        return false;
      }

      if (directOnly && !hasDirectListeningLink(release)) {
        return false;
      }

      return true;
    })
    .sort((left, right) => {
      if (normalizedQuery.length > 0 && right.score !== left.score) {
        return right.score - left.score;
      }

      return getPublishedTimestamp(right.release) - getPublishedTimestamp(left.release);
    })
    .map(({ release }) => release);
}

export function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s/+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSearchScore(release: SearchableReleaseListing, query: string) {
  if (!query) {
    return 1;
  }

  const tokens = query.split(" ").filter(Boolean);
  const fields = {
    artist: normalizeSearchText(release.artistName || ""),
    title: normalizeSearchText(release.title),
    project: normalizeSearchText(release.projectTitle || ""),
    genre: normalizeSearchText(release.genreName || ""),
    label: normalizeSearchText(release.labelName || ""),
    outlet: normalizeSearchText(release.outletName || ""),
    summary: normalizeSearchText(release.summary || ""),
    aiSummary: normalizeSearchText(release.aiSummary || ""),
    type: normalizeSearchText(release.releaseType.replace("_", " ")),
    source: normalizeSearchText(release.sourceUrl),
  };

  const combined = Object.values(fields).join(" ");
  if (!combined.includes(query) && !tokens.every((token) => combined.includes(token))) {
    return 0;
  }

  let score = 0;

  if (fields.artist.startsWith(query)) score += 80;
  if (fields.project.startsWith(query)) score += 75;
  if (fields.title.startsWith(query)) score += 70;
  if (fields.genre.startsWith(query)) score += 42;
  if (fields.label.startsWith(query)) score += 36;
  if (fields.artist.includes(query)) score += 34;
  if (fields.project.includes(query)) score += 30;
  if (fields.title.includes(query)) score += 28;
  if (fields.aiSummary.includes(query)) score += 18;
  if (fields.summary.includes(query)) score += 16;
  if (fields.outlet.includes(query)) score += 12;
  if (fields.source.includes(query)) score += 8;

  for (const token of tokens) {
    if (fields.artist.includes(token)) score += 10;
    if (fields.project.includes(token)) score += 9;
    if (fields.title.includes(token)) score += 8;
    if (fields.genre.includes(token)) score += 6;
    if (fields.label.includes(token)) score += 5;
    if (fields.aiSummary.includes(token)) score += 4;
    if (fields.summary.includes(token)) score += 3;
    if (fields.outlet.includes(token) || fields.type.includes(token)) score += 2;
  }

  return score;
}

function hasDirectListeningLink(release: SearchableReleaseListing) {
  return Boolean(
    release.youtubeUrl ||
      release.youtubeMusicUrl ||
      release.bandcampUrl ||
      detectPlatform(release.sourceUrl) === "youtube" ||
      detectPlatform(release.sourceUrl) === "youtube-music" ||
      detectPlatform(release.sourceUrl) === "bandcamp",
  );
}

function getReleasePlatform(release: SearchableReleaseListing) {
  const directPlatform = detectPlatform(release.sourceUrl);
  if (directPlatform) {
    return directPlatform;
  }

  if (release.youtubeUrl) {
    return "youtube";
  }

  if (release.youtubeMusicUrl) {
    return "youtube-music";
  }

  if (release.bandcampUrl) {
    return "bandcamp";
  }

  return null;
}

function getPublishedTimestamp(release: SearchableReleaseListing) {
  const publishedAt =
    release.publishedAt instanceof Date ? release.publishedAt : new Date(release.publishedAt);
  return publishedAt.getTime();
}
