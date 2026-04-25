import { cn, formatCompactUtcDate, formatCompactWholeCount, formatDiscussionShare } from "@/lib/utils";

type ReleaseStatsSummaryProps = {
  youtubeViewCount?: number | null;
  youtubePublishedAt?: Date | string | null;
  redditUpvotes?: number | null;
  redditComments?: number | null;
  bandcampSupporterCount?: number | null;
  bandcampFollowerCount?: number | null;
  compact?: boolean;
  className?: string;
};

type SummaryItem = {
  label: string;
  value: string;
  ariaLabel?: string;
};

export function ReleaseStatsSummary({
  youtubeViewCount,
  youtubePublishedAt,
  redditUpvotes,
  redditComments,
  bandcampSupporterCount,
  bandcampFollowerCount,
  compact = false,
  className,
}: ReleaseStatsSummaryProps) {
  const items = buildSummaryItems({
    youtubeViewCount,
    youtubePublishedAt,
    redditUpvotes,
    redditComments,
    bandcampSupporterCount,
    bandcampFollowerCount,
  });

  if (items.length === 0) {
    return null;
  }

  return (
    <dl
      aria-label={buildSummaryAriaLabel(items)}
      className={cn(
        "border border-[var(--color-line)] bg-[var(--color-panel)]/85",
        compact ? "grid max-w-full gap-0.5 px-3 py-2" : "grid gap-1 px-4 py-3",
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={`${item.label}-${item.value}`}
          className={cn(
            "grid grid-cols-[auto_1fr] items-baseline gap-x-2 gap-y-0.5 border-t border-[var(--color-line)]/65 first:border-t-0",
            compact ? "py-1 first:pt-0 last:pb-0" : "py-1.5 first:pt-0 last:pb-0",
          )}
        >
          <dt className={cn("uppercase tracking-[0.16em] text-black/48", compact ? "text-[9px]" : "text-[10px]")}>
            {item.label}
          </dt>
          <dd className={cn("text-right text-[var(--color-ink)]", compact ? "text-xs" : "text-sm serif-display")}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function buildSummaryItems(input: {
  youtubeViewCount?: number | null;
  youtubePublishedAt?: Date | string | null;
  redditUpvotes?: number | null;
  redditComments?: number | null;
  bandcampSupporterCount?: number | null;
  bandcampFollowerCount?: number | null;
}) {
  const items: SummaryItem[] = [];
  const youtubeViews = formatCompactWholeCount(input.youtubeViewCount);
  const youtubePublished = formatCompactUtcDate(input.youtubePublishedAt);
  const redditUpvotes = formatCompactWholeCount(input.redditUpvotes);
  const redditComments = formatCompactWholeCount(input.redditComments);
  const bandcampSupporters = formatCompactWholeCount(input.bandcampSupporterCount);
  const bandcampFollowers = formatCompactWholeCount(input.bandcampFollowerCount);
  const discussionShare = formatDiscussionShare(input.redditUpvotes, input.redditComments);

  if (youtubeViews) {
    items.push({
      label: "YouTube",
      value: `${youtubeViews} views`,
      ariaLabel: `${youtubeViews} YouTube views`,
    });
  }

  if (youtubePublished) {
    items.push({
      label: "Published",
      value: youtubePublished,
      ariaLabel: `Published on YouTube ${youtubePublished}`,
    });
  }

  if (redditUpvotes) {
    items.push({ label: "Upvotes", value: redditUpvotes });
  }

  if (redditComments) {
    items.push({ label: "Comments", value: redditComments });
  }

  if (bandcampSupporters) {
    items.push({
      label: "Bandcamp",
      value: `${bandcampSupporters} supporters`,
      ariaLabel: `${bandcampSupporters} Bandcamp supporters`,
    });
  }

  if (bandcampFollowers && items.length < 4) {
    items.push({
      label: "Bandcamp",
      value: `${bandcampFollowers} followers`,
      ariaLabel: `${bandcampFollowers} Bandcamp followers`,
    });
  }

  if (discussionShare !== null && items.length < 4) {
    items.push({ label: "Discussion share", value: `${discussionShare}%` });
  }

  return items;
}

function buildSummaryAriaLabel(items: SummaryItem[]) {
  return `Release statistics: ${items
    .map((item) => item.ariaLabel || `${item.label} ${item.value}`)
    .join("; ")}`;
}
