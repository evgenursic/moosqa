"use client";

import { useEffect } from "react";

import "./globals.css";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

export default function GlobalError({ error, unstable_retry }: GlobalErrorProps) {
  useEffect(() => {
    console.error("Global app error boundary triggered.", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--color-page-bg)] text-[var(--color-ink)]">
        <main className="editorial-shell flex min-h-screen items-start px-4 pb-10 pt-4 md:px-8">
          <div className="mx-auto w-full max-w-[1200px] bg-[var(--color-paper)] px-2 md:px-4">
            <section className="border-t border-[var(--color-line)] py-16">
              <p className="section-kicker text-black/43">Service interruption</p>
              <h1 className="mt-4 text-5xl leading-none text-[var(--color-ink)] serif-display md:text-6xl">
                MooSQA is temporarily unavailable.
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-black/63">
                Retry once. If the issue was transient, the homepage should come back without any other action.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => unstable_retry()}
                  className="inline-flex items-center border border-[var(--color-accent-strong)] bg-[var(--color-accent-strong)] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-white"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/";
                  }}
                  className="inline-flex items-center border border-[var(--color-line)] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink)]"
                >
                  Reload homepage
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
      </body>
    </html>
  );
}
