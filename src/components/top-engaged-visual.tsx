import type { ReactNode } from "react";
import { MessageSquare, Sparkles, TrendingUp } from "lucide-react";

type TopEngagedVisualProps = {
  score: number | null | undefined;
  commentCount: number | null | undefined;
  upvoteRatio: number | null | undefined;
  awardCount: number | null | undefined;
  crosspostCount: number | null | undefined;
};

const SCORE_MAX = 200;
const COMMENT_MAX = 80;

export function TopEngagedVisual({
  score,
  commentCount,
  upvoteRatio,
  awardCount,
  crosspostCount,
}: TopEngagedVisualProps) {
  const redditScore = Math.max(score ?? 0, 0);
  const comments = Math.max(commentCount ?? 0, 0);
  const approval = typeof upvoteRatio === "number" ? Math.round(upvoteRatio * 100) : null;
  const scoreWidth = clampPercent((redditScore / SCORE_MAX) * 100);
  const commentWidth = clampPercent((comments / COMMENT_MAX) * 100);

  return (
    <div className="mt-5 border border-[var(--color-line)] bg-[var(--color-panel)]/82 p-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <MetricRow
          icon={<TrendingUp size={13} strokeWidth={1.9} />}
          label="Reddit score"
          value={redditScore}
          barClassName="engagement-meter-fill engagement-meter-fill--score"
          width={scoreWidth}
        />
        <MetricRow
          icon={<MessageSquare size={13} strokeWidth={1.9} />}
          label="Comments"
          value={comments}
          barClassName="engagement-meter-fill engagement-meter-fill--comments"
          width={commentWidth}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {approval !== null ? (
          <StatChip
            icon={<TrendingUp size={11} strokeWidth={2} />}
            label={`${approval}% upvoted`}
          />
        ) : null}
        {(awardCount ?? 0) > 0 ? (
          <StatChip
            icon={<Sparkles size={11} strokeWidth={2} />}
            label={`${awardCount} ${awardCount === 1 ? "award" : "awards"}`}
          />
        ) : null}
        {(crosspostCount ?? 0) > 0 ? (
          <StatChip
            icon={<MessageSquare size={11} strokeWidth={2} />}
            label={`${crosspostCount} ${crosspostCount === 1 ? "crosspost" : "crossposts"}`}
          />
        ) : null}
      </div>
    </div>
  );
}

function MetricRow({
  icon,
  label,
  value,
  barClassName,
  width,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  barClassName: string;
  width: number;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-black/52">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-line)] bg-white/60 text-[var(--color-ink)]">
            {icon}
          </span>
          <span>{label}</span>
        </div>
        <span className="text-[1.85rem] leading-none text-[var(--color-ink)] serif-display">
          {value}
        </span>
      </div>

      <div className="engagement-meter mt-3">
        <span className={barClassName} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function StatChip({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-[var(--color-line)] bg-white/52 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-black/58">
      <span className="text-[var(--color-accent-strong)]">{icon}</span>
      <span>{label}</span>
    </span>
  );
}

function clampPercent(value: number) {
  return Math.max(6, Math.min(100, Math.round(value)));
}
