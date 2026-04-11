import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";

import { DebugReprocessControls } from "@/components/debug-reprocess-controls";
import { getRequiredDebugSecret } from "@/lib/admin-auth";
import { getQualityDashboardData } from "@/lib/quality-dashboard";
import { formatPubDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Quality Debug | MooSQA",
  robots: {
    index: false,
    follow: false,
  },
};

type DebugPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DebugPage({ searchParams }: DebugPageProps) {
  return (
    <Suspense fallback={<DebugShell />}>
      <DebugContent searchParams={searchParams} />
    </Suspense>
  );
}

async function DebugContent({ searchParams }: DebugPageProps) {
  await connection();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const secret = getSearchParamValue(resolvedSearchParams.secret);
  const allowedSecret = getRequiredDebugSecret();

  if (!allowedSecret || secret !== allowedSecret) {
    notFound();
  }

  const dashboard = await getQualityDashboardData();

  return (
    <DebugShell>
      <DebugReprocessControls secret={allowedSecret} />

      <section className="grid gap-4 border-t border-[var(--color-line)] py-8 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total releases" value={String(dashboard.totals.releases)} />
        <StatCard label="Retry queue" value={String(dashboard.totals.retryQueue)} />
        <StatCard label="Missing release date" value={String(dashboard.totals.missingReleaseDate)} />
        <StatCard label="Low quality under 70" value={String(dashboard.totals.lowQuality)} />
      </section>

      <section className="grid gap-4 border-t border-[var(--color-line)] py-8 lg:grid-cols-3">
        <StatusCard title="Artwork coverage" rows={dashboard.artwork} />
        <StatusCard title="Genre coverage" rows={dashboard.genre} />
        <StatusCard title="Link coverage" rows={dashboard.links} />
      </section>

      <section className="grid gap-4 border-t border-[var(--color-line)] py-8 md:grid-cols-3">
        <StatCard label="Genre missing" value={String(dashboard.genreAudit.missing)} />
        <StatCard label="Genre generic" value={String(dashboard.genreAudit.generic)} />
        <StatCard label="Genre suspicious" value={String(dashboard.genreAudit.suspicious)} />
      </section>

      <section className="grid gap-4 border-t border-[var(--color-line)] py-8 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Summary low quality" value={String(dashboard.summaryAudit.lowQuality)} />
        <StatCard label="Summary repetitive" value={String(dashboard.summaryAudit.repetitive)} />
        <StatCard
          label="Repeated patterns"
          value={String(dashboard.summaryAudit.repeatedPatterns.length)}
        />
        <StatCard
          label="Flagged summaries"
          value={String(dashboard.summaryAudit.flaggedCards.length)}
        />
      </section>

      <section className="border-t border-[var(--color-line)] py-8">
        <div className="mb-5">
          <p className="section-kicker text-black/43">Genre confidence</p>
          <h2 className="mt-3 text-4xl leading-none text-[var(--color-ink)] serif-display">
            Cards worth reviewing.
          </h2>
        </div>

        <div className="grid gap-4">
          {dashboard.genreAudit.suspiciousCards.map((release) => (
            <article
              key={release.id}
              className="border border-[var(--color-line)] bg-[var(--color-panel)] p-4"
            >
              <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-black/50">
                <span>{formatPubDate(release.publishedAt)}</span>
                <span>Current {release.currentGenre || "missing"}</span>
                <span>Suggested {release.suggestedGenre}</span>
              </div>
              <h3 className="mt-3 text-3xl leading-[0.94] text-[var(--color-ink)] serif-display">
                {release.artistName || release.projectTitle || release.title}
              </h3>
              <p className="mt-2 text-base text-black/66 serif-display">
                {release.projectTitle || release.title}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-[var(--color-line)] py-8">
        <div className="mb-5">
          <p className="section-kicker text-black/43">Override candidates</p>
          <h2 className="mt-3 text-4xl leading-none text-[var(--color-ink)] serif-display">
            Artists still drifting too wide.
          </h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {dashboard.genreAudit.artistSuggestions.map((entry) => (
            <article
              key={`${entry.artistName}-${entry.suggestedGenre}`}
              className="border border-[var(--color-line)] bg-[var(--color-panel)] p-4"
            >
              <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-black/50">
                <span>{entry.count} cards</span>
                <span>{entry.suggestedGenre}</span>
              </div>
              <h3 className="mt-3 text-3xl leading-[0.94] text-[var(--color-ink)] serif-display">
                {entry.artistName}
              </h3>
              <p className="mt-2 text-sm leading-7 text-black/62">
                Examples: {entry.exampleTitles.join(" • ")}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-[var(--color-line)] py-8">
        <div className="mb-5">
          <p className="section-kicker text-black/43">Summary quality</p>
          <h2 className="mt-3 text-4xl leading-none text-[var(--color-ink)] serif-display">
            Repetitive language audit.
          </h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {dashboard.summaryAudit.repeatedPatterns.map((entry) => (
            <article
              key={entry.patternLabel}
              className="border border-[var(--color-line)] bg-[var(--color-panel)] p-4"
            >
              <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-black/50">
                <span>{entry.count} cards</span>
              </div>
              <h3 className="mt-3 text-2xl leading-[0.96] text-[var(--color-ink)] serif-display">
                {entry.patternLabel}
              </h3>
              <p className="mt-3 text-sm leading-7 text-black/62">
                Examples: {entry.examples.join(" • ")}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-6 grid gap-4">
          {dashboard.summaryAudit.flaggedCards.map((release) => (
            <article
              key={release.id}
              className="border border-[var(--color-line)] bg-[var(--color-panel)] p-4"
            >
              <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-black/50">
                <span>{release.summaryQualityScore}/100</span>
                {release.patternLabel ? <span>{release.patternLabel}</span> : null}
                <span>{formatPubDate(release.publishedAt)}</span>
              </div>
              <h3 className="mt-3 text-3xl leading-[0.94] text-[var(--color-ink)] serif-display">
                {release.artistName || release.projectTitle || release.title}
              </h3>
              <p className="mt-2 text-base text-black/66 serif-display">
                {release.projectTitle || release.title}
              </p>
              {release.aiSummary ? (
                <p className="mt-3 text-sm leading-7 text-black/62">{release.aiSummary}</p>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-[var(--color-line)] py-8">
        <div className="mb-5">
          <p className="section-kicker text-black/43">Weak cards</p>
          <h2 className="mt-3 text-4xl leading-none text-[var(--color-ink)] serif-display">
            Most urgent fixes.
          </h2>
        </div>

        <div className="grid gap-4">
          {dashboard.recentWeakCards.map((release) => (
            <article
              key={release.id}
              className="border border-[var(--color-line)] bg-[var(--color-panel)] p-4"
            >
              <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-black/50">
                <span>{release.qualityScore}/100</span>
                <span>{release.artworkStatus}</span>
                <span>{release.genreStatus}</span>
                <span>{release.linkStatus}</span>
                <span>{formatPubDate(release.publishedAt)}</span>
                {release.releaseDate ? <span>Release {formatPubDate(release.releaseDate)}</span> : null}
              </div>
              <h3 className="mt-3 text-3xl leading-[0.94] text-[var(--color-ink)] serif-display">
                {release.artistName || release.projectTitle || release.title}
              </h3>
              <p className="mt-2 text-base text-black/66 serif-display">
                {release.artistName && release.projectTitle ? release.projectTitle : release.title}
              </p>
            </article>
          ))}
        </div>
      </section>
    </DebugShell>
  );
}

function DebugShell({ children }: { children?: ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--color-background)] px-4 py-6 md:px-8">
      <div className="mx-auto max-w-[1480px] bg-[var(--color-paper)] p-4 md:p-6">
        <section className="border-t border-[var(--color-line)] py-8">
          <p className="section-kicker text-black/43">Private debug</p>
          <h1 className="mt-3 text-5xl leading-none text-[var(--color-ink)] serif-display">
            Quality dashboard.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-black/63">
            Internal overview of weak cards, retry queue pressure, and metadata coverage.
          </p>
        </section>
        {children}
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      <p className="section-kicker text-black/43">{label}</p>
      <p className="mt-4 text-5xl text-[var(--color-ink)] serif-display">{value}</p>
    </div>
  );
}

function StatusCard({
  title,
  rows,
}: {
  title: string;
  rows: Record<string, number>;
}) {
  return (
    <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      <p className="section-kicker text-black/43">{title}</p>
      <div className="mt-4 grid gap-3 text-sm text-black/68">
        {Object.entries(rows).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between gap-3 border-t border-[var(--color-soft-line)] pt-3 first:border-t-0 first:pt-0">
            <span className="uppercase tracking-[0.16em] text-black/48">{key}</span>
            <span className="text-lg text-[var(--color-ink)] serif-display">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value || "";
}
