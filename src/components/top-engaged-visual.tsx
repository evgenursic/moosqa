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
  const engagementPercent = getEngagementPercent({
    score: redditScore,
    comments,
  });
  const tone = getEngagementTone(engagementPercent);
  const band = getEngagementBand(engagementPercent);

  if (compact) {
    return (
      <div className="mt-4 flex items-center gap-3 border border-[var(--color-line)] bg-[var(--color-panel)]/78 px-3 py-3">
        <div className={`engagement-grade engagement-grade--${band}`}>
          <span className="engagement-grade-letter">{band}</span>
          <span className="engagement-grade-value">{engagementPercent}%</span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-black/45">
            Indieheads engagement
          </p>
          <div className="engagement-meter mt-2">
            <span
              className={`engagement-meter-fill engagement-meter-fill--${band.toLowerCase()}`}
              style={{ width: `${Math.max(6, engagementPercent)}%` }}
            />
          </div>
          <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-black/52">
            Based on score and comments
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 border border-[var(--color-line)] bg-[var(--color-panel)]/84 p-4">
      <div className="grid gap-4 md:grid-cols-[8.75rem_minmax(0,1fr)]">
        <div className={`engagement-grade engagement-grade--expanded engagement-grade--${band}`}>
          <span className="engagement-grade-letter">{band}</span>
          <span className="engagement-grade-value">{engagementPercent}%</span>
          <span className="engagement-grade-caption">Engagement</span>
        </div>

        <div className="min-w-0">
          <p className="section-kicker text-black/45">Indieheads response</p>
          <p className="mt-2 text-2xl leading-tight text-[var(--color-ink)] serif-display">
            {tone}
          </p>

          <div className="engagement-meter mt-4">
            <span
              className={`engagement-meter-fill engagement-meter-fill--${band.toLowerCase()}`}
              style={{ width: `${Math.max(8, engagementPercent)}%` }}
            />
          </div>

          <p className="mt-4 text-[11px] uppercase tracking-[0.16em] text-black/56">
            Ratio of comment activity to Reddit score
          </p>
        </div>
      </div>
    </div>
  );
}

function getEngagementPercent(input: {
  score: number;
  comments: number;
}) {
  const weightedComments = input.comments * 3.5;
  const base = input.score + weightedComments;

  if (base <= 0) {
    return 0;
  }

  const ratio = (weightedComments / base) * 100;
  return Math.max(0, Math.min(100, Math.round(ratio)));
}

function getEngagementBand(percent: number) {
  if (percent >= 65) {
    return "A";
  }

  if (percent >= 48) {
    return "B";
  }

  if (percent >= 32) {
    return "C";
  }

  if (percent >= 18) {
    return "D";
  }

  return "E";
}

function getEngagementTone(percent: number) {
  if (percent >= 65) {
    return "Comment-heavy response";
  }

  if (percent >= 48) {
    return "Strong discussion pull";
  }

  if (percent >= 32) {
    return "Balanced score and discussion";
  }

  if (percent >= 18) {
    return "Mostly score-led traction";
  }

  return "Early, light discussion";
}
