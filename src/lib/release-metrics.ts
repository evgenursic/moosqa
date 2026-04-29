import { formatCompactWholeCount, formatDiscussionShare } from "@/lib/utils";
import { detectPlatform } from "@/lib/listening-links";

export type ReleaseMetricSignal = {
  kind:
    | "reddit-upvotes"
    | "youtube"
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
  youtubeViewCount?: number | string | null;
  redditUpvotes?: number | string | null;
  redditComments?: number | string | null;
  bandcampSupporterCount?: number | string | null;
  bandcampFollowerCount?: number | string | null;
  fallbackLabel?: string | null;
};

export function getPrimaryReleaseMetric(input: ReleaseMetricInput): ReleaseMetricSignal | null {
  const youtubeViewCount = coerceMetricNumber(input.youtubeViewCount);
  const redditUpvotes = coerceMetricNumber(input.redditUpvotes);
  const redditComments = coerceMetricNumber(input.redditComments);
  const bandcampSupporterCount = coerceMetricNumber(input.bandcampSupporterCount);
  const bandcampFollowerCount = coerceMetricNumber(input.bandcampFollowerCount);
  const preferYoutubeViews = isYouTubeFirstMetricInput(input);

  if (preferYoutubeViews) {
    const youtubeViews = formatCompactWholeCount(youtubeViewCount);
    if (youtubeViews) {
      return {
        kind: "youtube",
        label: `${youtubeViews} views`,
        ariaLabel: `${youtubeViews} YouTube views`,
      };
    }
  }

  const upvotes = formatCompactWholeCount(redditUpvotes);
  if (upvotes) {
    return buildRedditUpvotesMetric(upvotes);
  }

  const youtubeViews = formatCompactWholeCount(youtubeViewCount);
  if (youtubeViews) {
    return {
      kind: "youtube",
      label: `${youtubeViews} views`,
      ariaLabel: `${youtubeViews} YouTube views`,
    };
  }

  const comments = formatCompactWholeCount(redditComments);
  if (comments) {
    return {
      kind: "reddit-comments",
      label: `${comments} comments`,
      ariaLabel: `${comments} Reddit comments`,
    };
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

  const discussionShare = formatDiscussionShare(redditUpvotes, redditComments);
  if (discussionShare !== null) {
    return {
      kind: "discussion-share",
      label: `${discussionShare}% Discussion share`,
      ariaLabel: `${discussionShare}% Discussion share`,
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

export function isYouTubeFirstMetricInput(input: ReleaseMetricInput) {
  const sourcePlatform = detectPlatform(input.sourceUrl || "");
  if (sourcePlatform === "youtube" || sourcePlatform === "youtube-music") {
    return true;
  }

  return /\byoutube(?:\s+music)?\b/i.test(input.outletName || "");
}

function buildRedditUpvotesMetric(upvotes: string): ReleaseMetricSignal {
  return {
    kind: "reddit-upvotes",
    label: `${upvotes} upvotes`,
    ariaLabel: `${upvotes} Reddit upvotes`,
  };
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
