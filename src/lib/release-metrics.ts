import { formatCompactWholeCount, formatDiscussionShare } from "@/lib/utils";

export type ReleaseMetricSignal = {
  kind: "youtube" | "reddit-upvotes" | "reddit-comments" | "bandcamp-supporters" | "bandcamp-followers" | "discussion-share";
  label: string;
  ariaLabel: string;
};

export type ReleaseMetricInput = {
  youtubeViewCount?: number | null;
  redditUpvotes?: number | null;
  redditComments?: number | null;
  bandcampSupporterCount?: number | null;
  bandcampFollowerCount?: number | null;
};

export function buildBestReleaseMetricSignal(input: ReleaseMetricInput): ReleaseMetricSignal | null {
  const youtubeViews = formatCompactWholeCount(input.youtubeViewCount);
  if (youtubeViews) {
    return {
      kind: "youtube",
      label: `${youtubeViews} YouTube views`,
      ariaLabel: `${youtubeViews} YouTube views`,
    };
  }

  const redditUpvotes = formatCompactWholeCount(input.redditUpvotes);
  if (redditUpvotes) {
    return {
      kind: "reddit-upvotes",
      label: `${redditUpvotes} upvotes`,
      ariaLabel: `${redditUpvotes} Reddit upvotes`,
    };
  }

  const redditComments = formatCompactWholeCount(input.redditComments);
  if (redditComments) {
    return {
      kind: "reddit-comments",
      label: `${redditComments} comments`,
      ariaLabel: `${redditComments} Reddit comments`,
    };
  }

  const bandcampSupporters = formatCompactWholeCount(input.bandcampSupporterCount);
  if (bandcampSupporters) {
    return {
      kind: "bandcamp-supporters",
      label: `${bandcampSupporters} Bandcamp supporters`,
      ariaLabel: `${bandcampSupporters} Bandcamp supporters`,
    };
  }

  const bandcampFollowers = formatCompactWholeCount(input.bandcampFollowerCount);
  if (bandcampFollowers) {
    return {
      kind: "bandcamp-followers",
      label: `${bandcampFollowers} Bandcamp followers`,
      ariaLabel: `${bandcampFollowers} Bandcamp followers`,
    };
  }

  const discussionShare = formatDiscussionShare(input.redditUpvotes, input.redditComments);
  if (discussionShare !== null) {
    return {
      kind: "discussion-share",
      label: `${discussionShare}% Discussion share`,
      ariaLabel: `${discussionShare}% Discussion share`,
    };
  }

  return null;
}
