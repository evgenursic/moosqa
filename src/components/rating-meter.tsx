"use client";

import { useState, useTransition } from "react";

import { formatScore } from "@/lib/utils";

type RatingMeterProps = {
  releaseId: string;
  initialAverage: number;
  initialCount: number;
};

export function RatingMeter({
  releaseId,
  initialAverage,
  initialCount,
}: RatingMeterProps) {
  const [value, setValue] = useState(Math.max(50, Math.round(initialAverage || 72)));
  const [average, setAverage] = useState(initialAverage);
  const [count, setCount] = useState(initialCount);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitVote() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          releaseId,
          value,
        }),
      });

      const payload = (await response.json()) as {
        average?: number;
        count?: number;
        error?: string;
      };

      if (!response.ok) {
        setMessage(payload.error || "The rating could not be saved.");
        return;
      }

      setAverage(payload.average ?? average);
      setCount(payload.count ?? count);
      setMessage("Rating saved.");
    });
  }

  return (
    <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-kicker text-black/45">Community score</p>
          <p className="mt-3 text-4xl text-[var(--color-ink)]">{formatScore(average || 0)}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-black/45">{count} ratings</p>
        </div>
        <div className="border border-[var(--color-line)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-black/65">
          Your vote {value}
        </div>
      </div>

      <div className="mt-5">
        <input
          aria-label="Rate from 1 to 100"
          type="range"
          min={1}
          max={100}
          value={value}
          onChange={(event) => setValue(Number(event.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-black/10 accent-[var(--color-accent)]"
        />
        <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.18em] text-black/45">
          <span>1</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submitVote}
          disabled={isPending}
          className="inline-flex items-center justify-center border border-[var(--color-accent-strong)] bg-[var(--color-accent-strong)] px-4 py-3 text-xs uppercase tracking-[0.18em] text-white transition hover:opacity-92 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Submit rating"}
        </button>
        {message ? <p className="text-xs uppercase tracking-[0.18em] text-black/55">{message}</p> : null}
      </div>
    </div>
  );
}
