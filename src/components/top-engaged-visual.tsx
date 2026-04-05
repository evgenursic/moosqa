import type { ReactNode } from "react";
import { MessageSquare, Sparkles, TrendingUp } from "lucide-react";

type TopEngagedVisualProps = {
  score: number | null | undefined;
  commentCount: number | null | undefined;
  upvoteRatio: number | null | undefined;
  awardCount: number | null | undefined;
  crosspostCount: number | null | undefined;
};

const TOTAL_MAX = 260;

export function TopEngagedVisual({
  score,
  commentCount,
  upvoteRatio,
  awardCount,
  crosspostCount,
}: TopEngagedVisualProps) {
  const redditScore = Math.max(score ?? 0, 0);
  const comments = Math.max(commentCount ?? 0, 0);
  const combined = redditScore + comments;
  const approval = typeof upvoteRatio === "number" ? Math.round(upvoteRatio * 100) : null;
  const meterWidth = clampPercent((combined / TOTAL_MAX) * 100);
  const tone = getEngagementTone(redditScore, comments);

  return (
    <div className="mt-5 border border-[var(--color-line)] bg-[var(--color-panel)]/84 p-4">
      <div className="grid gap-4 md:grid-cols-[8.5rem_minmax(0,1fr)]">
        <div className="flex min-h-[8.5rem] flex-col justify-between border border-[var(--color-line)] bg-white/50 p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-black/46">Engagement</p>
          <div>
            <p className="truncate text-[2.25rem] leading-none text-[var(--color-ink)] serif-display">
              {combined}
            </p>
            <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-black/48">
              Score + comments
            </p>
          </div>
        </div>

        <div className="min-w-0">
          <p className="section-kicker text-black/45">Indieheads response</p>
          <p className="mt-2 text-2xl leading-tight text-[var(--color-ink)] serif-display">
            {tone}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MetricTile
              icon={<TrendingUp size={13} strokeWidth={1.9} />}
              label="Reddit score"
              value={redditScore}
            />
            <MetricTile
              icon={<MessageSquare size={13} strokeWidth={1.9} />}
              label="Comments"
              value={comments}
            />
          </div>

          <div className="engagement-meter mt-4">
            <span className="engagement-meter-fill engagement-meter-fill--score" style={{ width: `${meterWidth}%` }} />
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
      </div>
    </div>
  );
}

function MetricTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="min-w-0 border border-[var(--color-line)] bg-white/52 px-3 py-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-black/48">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-paper)] text-[var(--color-ink)]">
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-3 truncate text-[1.9rem] leading-none text-[var(--color-ink)] serif-display">
        {value}
      </p>
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

function getEngagementTone(score: number, comments: number) {
  const combined = score + comments;

  if (combined >= 140) {
    return "Strong community pull";
  }

  if (combined >= 80) {
    return "Clear reader interest";
  }

  if (combined >= 35) {
    return "Building traction";
  }

  return "Early response";
}

function clampPercent(value: number) {
  return Math.max(8, Math.min(100, Math.round(value)));
}
