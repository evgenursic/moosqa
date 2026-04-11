import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";

import { getRequiredDebugSecret } from "@/lib/admin-auth";
import { getOpsDashboardData } from "@/lib/ops-dashboard";
import { formatPubDate, formatRelative } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Ops Health | MooSQA",
  robots: {
    index: false,
    follow: false,
  },
};

type OpsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OpsPage({ searchParams }: OpsPageProps) {
  return (
    <Suspense fallback={<OpsShell />}>
      <OpsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function OpsContent({ searchParams }: OpsPageProps) {
  await connection();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const secret = getSearchParamValue(resolvedSearchParams.secret);
  const allowedSecret = getRequiredDebugSecret();

  if (!allowedSecret || secret !== allowedSecret) {
    notFound();
  }

  const dashboard = await getOpsDashboardData();

  return (
    <OpsShell>
        <section className="border-t border-[var(--color-line)] py-8">
          <p className="section-kicker text-black/43">Private ops</p>
          <h1 className="mt-3 text-5xl leading-none text-[var(--color-ink)] serif-display">
            Production health.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-black/63">
            Sync freshness, analytics activity, stale metadata, and global rate-limit pressure.
          </p>
        </section>

        <section className="grid gap-4 border-t border-[var(--color-line)] py-8 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Sync state" value={dashboard.sync.label} secondary={dashboard.sync.message} />
          <StatCard
            label="Last success"
            value={dashboard.sync.lastSuccessAt ? formatRelative(dashboard.sync.lastSuccessAt) : "Never"}
            secondary={dashboard.sync.lastSuccessAt ? formatPubDate(dashboard.sync.lastSuccessAt) : null}
          />
          <StatCard label="Consecutive failures" value={String(dashboard.sync.consecutiveFailures)} />
          <StatCard label="Stale metadata" value={String(dashboard.staleMetadata)} />
        </section>

        <section className="grid gap-4 border-t border-[var(--color-line)] py-8 md:grid-cols-2 xl:grid-cols-4">
          {dashboard.analytics.counts.map((entry) => (
            <StatCard
              key={entry.action}
              label={`${entry.action.toLowerCase().replaceAll("_", " ")} / 24h`}
              value={String(entry.count)}
            />
          ))}
        </section>

        <section className="grid gap-4 border-t border-[var(--color-line)] py-8 lg:grid-cols-2">
          <PanelCard title="Top tracked releases">
            <div className="grid gap-3">
              {dashboard.analytics.topReleases.map((entry) => (
                <div
                  key={`${entry.releaseId}-${entry.count}`}
                  className="flex items-center justify-between gap-4 border-t border-[var(--color-soft-line)] pt-3 first:border-t-0 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-lg text-[var(--color-ink)] serif-display">
                      {entry.release?.artistName || entry.release?.projectTitle || entry.release?.title || "Unknown release"}
                    </p>
                    <p className="truncate text-sm text-black/58 serif-display">
                      {entry.release?.projectTitle || entry.release?.title || entry.releaseId || "n/a"}
                    </p>
                  </div>
                  <span className="text-lg text-[var(--color-ink)] serif-display">{entry.count}</span>
                </div>
              ))}
            </div>
          </PanelCard>

          <PanelCard title="Rate-limit pressure">
            <div className="grid gap-3">
              {dashboard.activeRateLimits.map((entry) => (
                <div
                  key={`${entry.key}-${entry.updatedAt.toISOString()}`}
                  className="flex items-center justify-between gap-4 border-t border-[var(--color-soft-line)] pt-3 first:border-t-0 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm uppercase tracking-[0.16em] text-black/52">{entry.key}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-black/44">
                      resets {formatRelative(entry.resetAt)}
                    </p>
                  </div>
                  <span className="text-lg text-[var(--color-ink)] serif-display">{entry.count}</span>
                </div>
              ))}
            </div>
          </PanelCard>
        </section>

        <section className="grid gap-4 border-t border-[var(--color-line)] py-8 lg:grid-cols-3">
          <StatCard label="Retry queue" value={String(dashboard.quality.totals.retryQueue)} />
          <StatCard label="Low quality cards" value={String(dashboard.quality.totals.lowQuality)} />
          <StatCard label="Missing release date" value={String(dashboard.quality.totals.missingReleaseDate)} />
        </section>
    </OpsShell>
  );
}

function OpsShell({ children }: { children?: ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--color-background)] px-4 py-6 md:px-8">
      <div className="mx-auto max-w-[1480px] bg-[var(--color-paper)] p-4 md:p-6">{children}</div>
    </main>
  );
}

function PanelCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      <p className="section-kicker text-black/43">{title}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatCard({
  label,
  value,
  secondary,
}: {
  label: string;
  value: string;
  secondary?: string | null;
}) {
  return (
    <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      <p className="section-kicker text-black/43">{label}</p>
      <p className="mt-4 text-4xl text-[var(--color-ink)] serif-display">{value}</p>
      {secondary ? <p className="mt-2 text-sm leading-6 text-black/58">{secondary}</p> : null}
    </div>
  );
}

function getSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value || "";
}
