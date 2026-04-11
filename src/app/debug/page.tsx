import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getQualityDashboardData } from "@/lib/quality-dashboard";
import { formatPubDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

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
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const secret = getSearchParamValue(resolvedSearchParams.secret);
  const allowedSecret = process.env.DEBUG_SECRET || process.env.CRON_SECRET || "";

  if (!allowedSecret || secret !== allowedSecret) {
    notFound();
  }

  const dashboard = await getQualityDashboardData();

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
