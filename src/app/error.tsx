"use client";

import { useEffect } from "react";

type AppErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

export default function AppError({ error, unstable_retry }: AppErrorProps) {
  useEffect(() => {
    console.error("Route error boundary triggered.", error);
  }, [error]);

  return (
    <main className="editorial-shell flex-1 px-4 pb-10 pt-4 md:px-8">
      <div className="mx-auto max-w-[1200px] bg-[var(--color-paper)] px-2 md:px-4">
        <section className="border-t border-[var(--color-line)] py-16">
          <p className="section-kicker text-black/43">Temporary issue</p>
          <h1 className="mt-4 text-5xl leading-none text-[var(--color-ink)] serif-display md:text-6xl">
            This page hit a rendering error.
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-black/63">
            Reload the page once. If the issue was temporary, the feed should recover immediately.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="inline-flex items-center border border-[var(--color-accent-strong)] bg-[var(--color-accent-strong)] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-white"
            >
              Retry page
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = "/";
              }}
              className="inline-flex items-center border border-[var(--color-line)] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink)]"
            >
              Go to homepage
            </button>
          </div>
          {error.digest ? (
            <p className="mt-6 text-[11px] uppercase tracking-[0.18em] text-black/42">
              Error digest {error.digest}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
