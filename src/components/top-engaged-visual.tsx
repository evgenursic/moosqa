import type { ReactNode } from "react";
import { MessageSquare, Sparkles, TrendingUp } from "lucide-react";

type TopEngagedVisualProps = {
  score: number | null | undefined;
  commentCount: number | null | undefined;
  awardCount: number | null | undefined;
  crosspostCount: number | null | undefined;
};

const INDEX_WEIGHT_CAP = 320;

export function TopEngagedVisual({
  score,
  commentCount,
  awardCount,
  crosspostCount,
}: TopEngagedVisualProps) {
  const redditScore = Math.max(score ?? 0, 0);
  const comments = Math.max(commentCount ?? 0, 0);
  const awards = Math.max(awardCount ?? 0, 0);
  const crossposts = Math.max(crosspostCount ?? 0, 0);
  const weightedScore = redditScore;
  const weightedComments = comments * 3;
  const weightedBonus = awards * 10 + crossposts * 8;
  const weightedTotal = weightedScore + weightedComments + weightedBonus;
  const engagementIndex = getEngagementIndex(weightedTotal);
  const scoreSegment = clampPercent((weightedScore / INDEX_WEIGHT_CAP) * 100, 0);
  const commentSegment = clampPercent((weightedComments / INDEX_WEIGHT_CAP) * 100, 0);
  const bonusSegment = clampPercent((weightedBonus / INDEX_WEIGHT_CAP) * 100, 0);
  const totalMeterWidth = clampPercent(scoreSegment + commentSegment + bonusSegment);
  const tone = getEngagementTone(engagementIndex);

  return (
    <div className="mt-5 border border-[var(--color-line)] bg-[var(--color-panel)]/84 p-4">
      <div className="grid gap-4 md:grid-cols-[9rem_minmax(0,1fr)]">
        <div className="flex min-h-[9rem] flex-col justify-between border border-[var(--color-line)] bg-white/52 p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-black/46">Engagement</p>
          <div>
            <p className="truncate text-[2.4rem] leading-none text-[var(--color-ink)] serif-display">
              {engagementIndex}%
            </p>
            <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-black/48">
              Score + comments
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] uppercase tracking-[0.14em] text-black/52">
            <CompactMetric
              icon={<TrendingUp size={11} strokeWidth={2} />}
              label="Score"
              value={redditScore}
            />
            <CompactMetric
              icon={<MessageSquare size={11} strokeWidth={2} />}
              label="Comments"
              value={comments}
            />
          </div>
        </div>

        <div className="min-w-0">
          <p className="section-kicker text-black/45">Indieheads response</p>
          <p className="mt-2 text-2xl leading-tight text-[var(--color-ink)] serif-display">
            {tone}
          </p>

          <div className="engagement-meter mt-4">
            <span
              className="engagement-meter-fill engagement-meter-fill--score"
              style={{ width: `${scoreSegment}%` }}
            />
            <span
              className="engagement-meter-fill engagement-meter-fill--comment"
              style={{ left: `${scoreSegment}%`, width: `${commentSegment}%` }}
            />
            <span
              className="engagement-meter-fill engagement-meter-fill--bonus"
              style={{ left: `${scoreSegment + commentSegment}%`, width: `${bonusSegment}%` }}
            />
            <span className="engagement-meter-cap" style={{ width: `${totalMeterWidth}%` }} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {awards > 0 ? (
              <StatChip
                icon={<Sparkles size={11} strokeWidth={2} />}
                label={`${awards} ${awards === 1 ? "award" : "awards"}`}
              />
            ) : null}
            {crossposts > 0 ? (
              <StatChip
                icon={<MessageSquare size={11} strokeWidth={2} />}
                label={`${crossposts} ${crossposts === 1 ? "crosspost" : "crossposts"}`}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function CompactMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="min-w-0 border border-[var(--color-line)] bg-[var(--color-paper)]/64 px-2 py-2">
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.14em] text-black/46">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-line)] bg-white/70 text-[var(--color-ink)]">
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      <p
        className="mt-2 truncate text-[1.2rem] leading-none text-[var(--color-ink)] serif-display"
        title={String(value)}
      >
        {formatCompactStat(value)}
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

function getEngagementTone(index: number) {
  if (index >= 82) {
    return "Strong community pull";
  }

  if (index >= 62) {
    return "Clear reader interest";
  }

  if (index >= 38) {
    return "Building traction";
  }

  return "Early response";
}

function getEngagementIndex(weightedTotal: number) {
  if (weightedTotal <= 0) {
    return 0;
  }

  const scaled = (Math.log10(weightedTotal + 1) / Math.log10(INDEX_WEIGHT_CAP + 1)) * 100;
  return clampPercent(scaled, 0);
}

function clampPercent(value: number, minimum = 8) {
  return Math.max(minimum, Math.min(100, Math.round(value)));
}

function formatCompactStat(value: number) {
  return new Intl.NumberFormat("en", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}
