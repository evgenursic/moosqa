import type { CSSProperties } from "react";

import { formatScore } from "@/lib/utils";

type TopRatedVisualProps = {
  average: number;
  count: number;
};

export function TopRatedVisual({ average, count }: TopRatedVisualProps) {
  const normalizedScore = clamp(Math.round(average || 0), 0, 100);
  const scoreColor = getScoreColor(normalizedScore);
  const scoreLabel = getScoreLabel(normalizedScore);

  return (
    <div className="mt-5 border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-4">
      <div className="flex items-center gap-4">
        <div
          className="score-ring"
          style={
            {
              "--score-angle": `${normalizedScore * 3.6}deg`,
              "--score-color": scoreColor,
            } as CSSProperties
          }
        >
          <div className="score-ring__inner">
            <span className="score-ring__value">{formatScore(normalizedScore)}</span>
          </div>
        </div>

        <div className="min-w-0">
          <p className="section-kicker text-black/45">User rating</p>
          <p className="mt-2 text-2xl leading-tight text-[var(--color-ink)] serif-display">
            {scoreLabel}
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-black/48">
            Based on {count} {count === 1 ? "user" : "users"}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div className="score-meter-track">
          <span
            className="score-meter-indicator"
            style={{ left: `clamp(0.4rem, calc(${normalizedScore}% - 0.45rem), calc(100% - 1.1rem))` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.18em] text-black/45">
          <span>Low</span>
          <span>Mixed</span>
          <span>High</span>
        </div>
      </div>
    </div>
  );
}

function getScoreLabel(score: number) {
  if (score >= 85) {
    return "Outstanding response";
  }

  if (score >= 70) {
    return "Strong community favorite";
  }

  if (score >= 55) {
    return "Mixed to positive";
  }

  if (score >= 40) {
    return "Mixed or average";
  }

  return "Still dividing listeners";
}

function getScoreColor(score: number) {
  if (score >= 80) {
    return "#7fce6c";
  }

  if (score >= 60) {
    return "#d7dc45";
  }

  if (score >= 40) {
    return "#f4b44b";
  }

  return "#f1737a";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
