import { formatCompactUtcDate, formatDiscussionShare, formatWholeCount } from "@/lib/utils";

type ReleasePublicCountersProps = {
  youtubeViewCount?: number | null | undefined;
  youtubePublishedAt?: Date | string | null;
  redditUpvotes?: number | null | undefined;
  redditComments?: number | null | undefined;
  openCount: number | null | undefined;
  listenClickCount: number | null | undefined;
  shareCount: number | null | undefined;
  positiveReactionCount: number | null | undefined;
  negativeReactionCount: number | null | undefined;
};

export function ReleasePublicCounters({
  youtubeViewCount,
  youtubePublishedAt,
  redditUpvotes,
  redditComments,
  openCount,
  listenClickCount,
  shareCount,
  positiveReactionCount,
  negativeReactionCount,
}: ReleasePublicCountersProps) {
  const safeOpenCount = sanitizeMetric(openCount);
  const safeListenClickCount = sanitizeMetric(listenClickCount);
  const safeShareCount = sanitizeMetric(shareCount);
  const safePositiveReactionCount = sanitizeMetric(positiveReactionCount);
  const safeNegativeReactionCount = sanitizeMetric(negativeReactionCount);
  const safeYouTubeViewCount = sanitizeMetric(youtubeViewCount);
  const safeRedditUpvotes = sanitizeMetric(redditUpvotes);
  const safeRedditComments = sanitizeMetric(redditComments);
  const discussionShare = formatDiscussionShare(safeRedditUpvotes, safeRedditComments);
  const compactYouTubePublishedAt = formatCompactUtcDate(youtubePublishedAt);
  const items = [
    ...(safeYouTubeViewCount > 0 ? [{ label: "YouTube views", value: formatWholeCount(safeYouTubeViewCount) }] : []),
    ...(compactYouTubePublishedAt
      ? [{ label: "YouTube published", value: compactYouTubePublishedAt }]
      : []),
    ...(safeRedditUpvotes > 0 ? [{ label: "Reddit upvotes", value: formatWholeCount(safeRedditUpvotes) }] : []),
    ...(safeRedditComments > 0 ? [{ label: "Reddit comments", value: formatWholeCount(safeRedditComments) }] : []),
    ...(discussionShare !== null ? [{ label: "Discussion share", value: `${discussionShare}%` }] : []),
    ...(safeOpenCount > 0 ? [{ label: "MooSQA opens", value: formatWholeCount(safeOpenCount) }] : []),
    ...(safeListenClickCount > 0 ? [{ label: "Listen clicks", value: formatWholeCount(safeListenClickCount) }] : []),
    ...(safeShareCount > 0 ? [{ label: "Shares", value: formatWholeCount(safeShareCount) }] : []),
    ...(safePositiveReactionCount > 0 ? [{ label: "Likes", value: formatWholeCount(safePositiveReactionCount) }] : []),
    ...(safeNegativeReactionCount > 0 ? [{ label: "Dislikes", value: formatWholeCount(safeNegativeReactionCount) }] : []),
  ];

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
      <p className="section-kicker text-black/45">Audience signals</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="border border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-3">
            <p className="section-kicker text-black/43">{item.label}</p>
            <p className="mt-2 text-2xl text-[var(--color-ink)] serif-display">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function sanitizeMetric(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}
