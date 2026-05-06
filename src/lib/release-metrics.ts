import { formatCompactWholeCount } from "@/lib/utils";
import { detectPlatform } from "@/lib/listening-links";

export type ReleaseMetricSignal = {
  kind:
    | "reddit-upvotes"
    | "youtube"
    | "popularity"
    | "reddit-comments"
    | "bandcamp-supporters"
    | "bandcamp-followers"
    | "discussion-share"
    | "fallback";
  label: string;
  ariaLabel: string;
};

export type ReleaseMetricInput = {
  sourceUrl?: string | null;
  outletName?: string | null;
  youtubeUrl?: string | null;
  youtubeMusicUrl?: string | null;
  youtubeViewCount?: number | string | null;
  redditUpvotes?: number | string | null;
  redditComments?: number | string | null;
  popularityMaxRaw?: number | string | null;
  bandcampSupporterCount?: number | string | null;
  bandcampFollowerCount?: number | string | null;
  fallbackLabel?: string | null;
};

export function getPrimaryReleaseMetric(input: ReleaseMetricInput): ReleaseMetricSignal | null {
  const youtubeViewCount = coerceMetricNumber(input.youtubeViewCount);
  const bandcampSupporterCount = coerceMetricNumber(input.bandcampSupporterCount);
  const bandcampFollowerCount = coerceMetricNumber(input.bandcampFollowerCount);
  const preferYoutubeViews = isYouTubeFirstMetricInput(input);

  if (preferYoutubeViews || youtubeViewCount) {
    const youtubeViews = formatCompactWholeCount(youtubeViewCount);
    if (youtubeViews) {
      return {
        kind: "youtube",
        label: `${youtubeViews} views`,
        ariaLabel: `${youtubeViews} YouTube views`,
      };
    }
  }

  const bandcampSupporters = formatCompactWholeCount(bandcampSupporterCount);
  if (bandcampSupporters) {
    return {
      kind: "bandcamp-supporters",
      label: `${bandcampSupporters} supporters`,
      ariaLabel: `${bandcampSupporters} Bandcamp supporters`,
    };
  }

  const bandcampFollowers = formatCompactWholeCount(bandcampFollowerCount);
  if (bandcampFollowers) {
    return {
      kind: "bandcamp-followers",
      label: `${bandcampFollowers} followers`,
      ariaLabel: `${bandcampFollowers} Bandcamp followers`,
    };
  }

  const fallbackLabel = sanitizeFallbackLabel(input.fallbackLabel);
  if (fallbackLabel) {
    return {
      kind: "fallback",
      label: fallbackLabel,
      ariaLabel: fallbackLabel,
    };
  }

  return null;
}

export const buildBestReleaseMetricSignal = getPrimaryReleaseMetric;

type PopularitySource = {
  score?: number | string | null;
  commentCount?: number | string | null;
  redditUpvotes?: number | string | null;
  redditComments?: number | string | null;
};

export function getPopularityRaw(input: PopularitySource) {
  const upvotes = coerceMetricNumber(input.redditUpvotes ?? input.score);
  const comments = coerceMetricNumber(input.redditComments ?? input.commentCount);
  return Math.max(upvotes || 0, 0) + Math.max(comments || 0, 0);
}

export function getPopularityMaxForReleases<T extends PopularitySource>(releases: T[]) {
  const max = Math.max(0, ...releases.map(getPopularityRaw));
  return max > 0 ? max : null;
}

export function isYouTubeFirstMetricInput(input: ReleaseMetricInput) {
  const sourcePlatform = detectPlatform(input.sourceUrl || "");
  const youtubePlatform = detectPlatform(input.youtubeUrl || "");
  const youtubeMusicPlatform = detectPlatform(input.youtubeMusicUrl || "");
  if (
    sourcePlatform === "youtube" ||
    sourcePlatform === "youtube-music" ||
    youtubePlatform === "youtube" ||
    youtubeMusicPlatform === "youtube-music"
  ) {
    return true;
  }

  return /\byoutube(?:\s+music)?\b/i.test(input.outletName || "");
}

function coerceMetricNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  return null;
}

function sanitizeFallbackLabel(value: string | null | undefined) {
  const label = value?.replace(/\s+/g, " ").trim();
  return label ? label.slice(0, 24) : null;
}
