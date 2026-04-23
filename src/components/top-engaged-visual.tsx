import { formatDiscussionShare, formatWholeCount } from "@/lib/utils";

type TopEngagedVisualProps = {
  score: number | null | undefined;
  commentCount: number | null | undefined;
  compact?: boolean;
};

export function TopEngagedVisual({
  score,
  commentCount,
  compact = false,
}: TopEngagedVisualProps) {
  const redditScore = Math.max(score ?? 0, 0);
  const comments = Math.max(commentCount ?? 0, 0);
  const discussionShare = formatDiscussionShare(redditScore, comments);

  if (redditScore <= 0 && comments <= 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="mt-4 border border-[var(--color-line)] bg-[var(--color-panel)]/78 px-3 py-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-black/45">
          Indieheads response
        </p>
        <div className={`mt-3 grid gap-2 ${discussionShare !== null ? "grid-cols-3" : "grid-cols-2"}`}>
          <MetricCell label="Upvotes" value={formatWholeCount(redditScore)} compact />
          <MetricCell label="Comments" value={formatWholeCount(comments)} compact />
          {discussionShare !== null ? (
            <MetricCell label="Discussion share" value={`${discussionShare}%`} compact />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 border border-[var(--color-line)] bg-[var(--color-panel)]/84 p-4">
      <p className="section-kicker text-black/45">Indieheads response</p>
      <p className="mt-2 text-2xl leading-tight text-[var(--color-ink)] serif-display">
        Raw Reddit response from the original thread.
      </p>
      <div className={`mt-4 grid gap-3 ${discussionShare !== null ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        <MetricCell label="Upvotes" value={formatWholeCount(redditScore)} />
        <MetricCell label="Comments" value={formatWholeCount(comments)} />
        {discussionShare !== null ? (
          <MetricCell label="Discussion share" value={`${discussionShare}%`} />
        ) : null}
      </div>
    </div>
  );
}

function MetricCell({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-3">
      <p className={`${compact ? "text-[9px]" : "section-kicker"} text-black/45`}>{label}</p>
      <p className={`${compact ? "mt-1 text-lg" : "mt-2 text-2xl"} text-[var(--color-ink)] serif-display`}>
        {value}
      </p>
    </div>
  );
}
