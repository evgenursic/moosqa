"use client";

import { useState } from "react";

type DebugReprocessControlsProps = {
  secret: string;
};

type ReprocessState = {
  queued: number;
  checked: number;
  improved: number;
  processedAt: string;
} | null;

export function DebugReprocessControls({
  secret,
}: DebugReprocessControlsProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReprocessState>(null);

  async function handleRun(limit: number) {
    setIsRunning(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/debug/reprocess?secret=${encodeURIComponent(secret)}&limit=${limit}`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error(`Reprocess failed with ${response.status}`);
      }

      const payload = (await response.json()) as {
        queued: number;
        checked: number;
        improved: number;
        processedAt: string;
      };

      setResult({
        queued: payload.queued,
        checked: payload.checked,
        improved: payload.improved,
        processedAt: payload.processedAt,
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Reprocess failed");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <section className="border-t border-[var(--color-line)] py-8">
      <div className="mb-5">
        <p className="section-kicker text-black/43">Admin action</p>
        <h2 className="mt-3 text-4xl leading-none text-[var(--color-ink)] serif-display">
          Reprocess weak cards.
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-black/63">
          Manual retry for the newest weak cards when you want to accelerate images, genres, dates,
          links, and summaries without waiting for the hourly background job.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {[6, 12, 18].map((limit) => (
          <button
            key={limit}
            type="button"
            onClick={() => handleRun(limit)}
            disabled={isRunning}
            className="inline-flex items-center border border-[var(--color-line)] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {isRunning ? "Processing..." : `Retry ${limit}`}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-700">{error}</p>
      ) : null}

      {result ? (
        <p className="mt-4 text-sm text-black/66">
          Last manual run checked {result.checked} cards, improved {result.improved}, and refreshed
          a queue of {result.queued} at {new Date(result.processedAt).toLocaleString()}.
        </p>
      ) : null}
    </section>
  );
}
