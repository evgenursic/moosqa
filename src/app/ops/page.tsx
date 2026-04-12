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
        {dashboard.alerts.length > 0 ? (
          <section className="grid gap-3 border-t border-[var(--color-line)] py-8">
            {dashboard.alerts.map((alert) => (
              <div
                key={alert.key}
                className="border border-[#d48b6d] bg-[#fff1e8] p-4 text-sm leading-7 text-[#6a3a27]"
              >
                <p className="section-kicker text-[#9a5a41]">{alert.severity}</p>
                <p className="mt-2 text-xl text-[var(--color-ink)] serif-display">{alert.title}</p>
                <p className="mt-2">{alert.message}</p>
              </div>
            ))}
          </section>
        ) : null}

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
              {dashboard.analytics.aggregateTopReleases.map((entry) => (
                <div
                  key={`${entry.id}-${entry.analyticsUpdatedAt?.toISOString() || "none"}`}
                  className="flex items-center justify-between gap-4 border-t border-[var(--color-soft-line)] pt-3 first:border-t-0 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-lg text-[var(--color-ink)] serif-display">
                      {entry.artistName || entry.projectTitle || entry.title || "Unknown release"}
                    </p>
                    <p className="truncate text-sm text-black/58 serif-display">
                      {entry.projectTitle || entry.title || entry.id || "n/a"}
                    </p>
                  </div>
                  <div className="text-right text-xs uppercase tracking-[0.14em] text-black/52">
                    <p>{entry.openCount} opens</p>
                    <p>{entry.listenClickCount} listens</p>
                    <p>{entry.shareCount} shares</p>
                  </div>
                </div>
              ))}
            </div>
          </PanelCard>

          <PanelCard title="GitHub workflows">
            <div className="grid gap-3">
              {dashboard.workflows.map((workflow) => (
                <div
                  key={workflow.workflowName}
                  className="flex items-center justify-between gap-4 border-t border-[var(--color-soft-line)] pt-3 first:border-t-0 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm uppercase tracking-[0.16em] text-black/52">
                      {workflow.workflowName}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-black/44">
                      {workflow.lastRunAt ? `last run ${formatRelative(workflow.lastRunAt)}` : "no runs yet"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm uppercase tracking-[0.14em] text-[var(--color-ink)]">
                      {workflow.status}
                    </span>
                    {workflow.runUrl ? (
                      <a
                        href={workflow.runUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="section-kicker text-[var(--color-accent-strong)]"
                      >
                        Open
                      </a>
                    ) : null}
                  </div>
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

        <section className="border-t border-[var(--color-line)] py-8">
          <PanelCard title="Alert digest history">
            <div className="grid gap-3">
              {dashboard.recentAlerts.map((alert) => (
                <div
                  key={`${alert.key}-${alert.lastTriggeredAt.toISOString()}`}
                  className="grid gap-3 border-t border-[var(--color-soft-line)] pt-3 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0">
                    <p className="section-kicker text-black/43">
                      {alert.severity} / {alert.status}
                    </p>
                    <p className="mt-2 text-2xl leading-tight text-[var(--color-ink)] serif-display">
                      {alert.title}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-black/62">{alert.message}</p>
                  </div>
                  <div className="border border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-3 text-right">
                    <p className="section-kicker text-black/43">Triggered</p>
                    <p className="mt-2 text-sm uppercase tracking-[0.14em] text-[var(--color-ink)]">
                      {formatRelative(alert.lastTriggeredAt)}
                    </p>
                    <p className="mt-1 text-xs leading-6 text-black/48">
                      {formatPubDate(alert.lastTriggeredAt)}
                    </p>
                    <p className="mt-3 section-kicker text-black/43">Delivered</p>
                    <p className="mt-2 text-sm uppercase tracking-[0.14em] text-[var(--color-ink)]">
                      {alert.lastNotifiedAt ? formatRelative(alert.lastNotifiedAt) : "Not yet"}
                    </p>
                    <p className="mt-1 text-xs leading-6 text-black/48">
                      {alert.notificationCount} notification{alert.notificationCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </PanelCard>
        </section>

        <section className="border-t border-[var(--color-line)] py-8">
          <PanelCard title="Daily analytics growth">
            <div className="grid gap-3">
              {dashboard.analytics.daily.map((entry) => (
                <div
                  key={entry.dateKey}
                  className="grid gap-3 border-t border-[var(--color-soft-line)] pt-3 first:border-t-0 first:pt-0 md:grid-cols-[8rem_repeat(6,minmax(0,1fr))]"
                >
                  <div>
                    <p className="text-sm uppercase tracking-[0.16em] text-black/52">{entry.label}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-black/42">{entry.total} total</p>
                  </div>
                  <DailyMetric label="Opens" value={entry.counts.OPEN} />
                  <DailyMetric label="Listen" value={entry.counts.LISTEN_CLICK} />
                  <DailyMetric label="Shares" value={entry.counts.SHARE} />
                  <DailyMetric label="Votes" value={entry.counts.VOTE} />
                  <DailyMetric label="Likes" value={entry.counts.REACTION_POSITIVE} />
                  <DailyMetric label="Dislikes" value={entry.counts.REACTION_NEGATIVE} />
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

function DailyMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-3">
      <p className="section-kicker text-black/43">{label}</p>
      <p className="mt-2 text-xl text-[var(--color-ink)] serif-display">{value}</p>
    </div>
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
