import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { ArchivePagination } from "@/components/archive-pagination";
import { PageScrollRestorer } from "@/components/page-scroll-restorer";
import { ReleaseCard } from "@/components/release-card";
import { ShareFilterLink } from "@/components/share-filter-link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  buildSignalArchiveHref,
  parseSignalArchiveTimeframe,
  type SignalArchiveSlug,
  type SignalArchiveTimeframe,
} from "@/lib/archive-links";
import { getSignalArchivePage } from "@/lib/analytics";
import { getSiteUrl } from "@/lib/site";

type SignalArchivePageProps = {
  params: Promise<{
    signal: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
  searchParams,
}: SignalArchivePageProps): Promise<Metadata> {
  const { signal } = await params;
  if (!isSignalArchiveSlug(signal)) {
    return {
      title: "Audience signals | MooSQA",
    };
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const page = parsePageParam(resolvedSearchParams.page);
  const timeframe = parseTimeframeParam(resolvedSearchParams.window, signal);
  const archive = await getSignalArchivePage(signal, page, timeframe);
  const canonicalUrl = new URL(archive.canonicalHref, getSiteUrl()).toString();

  return {
    title: `${archive.title}${page > 1 ? ` | Page ${page}` : ""} | MooSQA`,
    description: archive.description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${archive.title} | MooSQA`,
      description: archive.description,
      url: canonicalUrl,
    },
    twitter: {
      card: "summary",
      title: `${archive.title} | MooSQA`,
      description: archive.description,
    },
  };
}

export default function SignalArchivePage({
  params,
  searchParams,
}: SignalArchivePageProps) {
  return (
    <Suspense fallback={<SignalArchiveShell />}>
      <SignalArchiveContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function SignalArchiveContent({
  params,
  searchParams,
}: SignalArchivePageProps) {
  await connection();
  const { signal } = await params;
  if (!isSignalArchiveSlug(signal)) {
    notFound();
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const page = parsePageParam(resolvedSearchParams.page);
  const timeframe = parseTimeframeParam(resolvedSearchParams.window, signal);
  const archive = await getSignalArchivePage(signal, page, timeframe);

  return (
    <main className="editorial-shell flex-1 px-4 pb-10 pt-4 md:px-8">
      <div className="mx-auto max-w-[1760px] bg-[var(--color-paper)] px-2 md:px-4">
        <SiteHeader />
        <PageScrollRestorer />

        <section className="border-t border-[var(--color-line)] py-10">
          <div className="flex flex-col gap-5 border-b border-[var(--color-soft-line)] pb-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="section-kicker text-black/43">{archive.kicker}</p>
              <h1 className="mt-3 text-5xl leading-none text-[var(--color-ink)] serif-display md:text-6xl">
                {archive.title}.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-black/63">
                {archive.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.18em] text-black/55">
              <span className="border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2">
                {archive.total} ranked releases
              </span>
              <span className="border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2">
                Page {archive.page} / {archive.pageCount}
              </span>
              <span className="border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2">
                Window {archive.timeframe}
              </span>
              <ShareFilterLink href={archive.canonicalHref} label={archive.title} />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 border-b border-[var(--color-soft-line)] pb-6 text-[11px] uppercase tracking-[0.18em]">
            {(["today", "7d", "30d"] as SignalArchiveTimeframe[]).map((windowValue) => (
              <Link
                key={windowValue}
                href={buildSignalArchiveHref(signal, 1, windowValue)}
                prefetch
                scroll={false}
                className={
                  windowValue === archive.timeframe
                    ? "inline-flex items-center border border-[var(--color-accent-strong)] bg-[var(--color-accent-strong)] px-3 py-2 text-white"
                    : "inline-flex items-center border border-[var(--color-line)] px-3 py-2 text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
                }
              >
                {windowValue}
              </Link>
            ))}
          </div>

          {archive.entries.length > 0 ? (
            <div className="mt-8 grid gap-8 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
              {archive.entries.map((entry, index) =>
                entry.release ? (
                  <div key={`${signal}-${entry.release.id}`} className="border-t border-[var(--color-line)] pt-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="section-kicker text-black/43">#{index + 1}</p>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent-strong)]">
                        {entry.count} {archive.countLabel}
                      </p>
                    </div>
                    <ReleaseCard
                      release={entry.release}
                      compact={index > 3}
                      priority={index < 2}
                      fromHref={`${archive.canonicalHref}#archive`}
                    />
                  </div>
                ) : null,
              )}
            </div>
          ) : (
            <div className="mt-8 border border-[var(--color-line)] bg-[var(--color-panel)] p-6 text-sm leading-7 text-black/63">
              No ranked releases are available for this signal yet.
            </div>
          )}

          <ArchivePagination
            page={archive.page}
            pageCount={archive.pageCount}
            buildHref={(nextPage) => buildSignalArchiveHref(signal, nextPage, archive.timeframe)}
          />
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}

function SignalArchiveShell() {
  return (
    <main className="editorial-shell flex-1 px-4 pb-10 pt-4 md:px-8">
      <div className="mx-auto max-w-[1760px] bg-[var(--color-paper)] px-2 md:px-4">
        <section className="border-t border-[var(--color-line)] py-10">
          <div className="h-24 animate-pulse border border-[var(--color-line)] bg-[var(--color-panel)]" />
        </section>
      </div>
    </main>
  );
}

function isSignalArchiveSlug(value: string): value is SignalArchiveSlug {
  return (
    value === "opened" ||
    value === "shared" ||
    value === "listened" ||
    value === "liked" ||
    value === "disliked" ||
    value === "discussed"
  );
}

function parsePageParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw || "1");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseTimeframeParam(
  value: string | string[] | undefined,
  signal: SignalArchiveSlug,
) {
  return parseSignalArchiveTimeframe(value, signal === "opened" ? "today" : "7d");
}
