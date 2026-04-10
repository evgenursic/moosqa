import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReleaseCard } from "@/components/release-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SyncStatusStrip } from "@/components/sync-status-strip";
import {
  getSectionArchivePage,
  isReleaseSectionKey,
  releaseSectionDefinitions,
} from "@/lib/release-sections";
import { getSiteUrl } from "@/lib/site";
import { getSyncStatusSummary } from "@/lib/sync-releases";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BrowseSectionPageProps = {
  params: Promise<{
    section: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: BrowseSectionPageProps): Promise<Metadata> {
  const { section } = await params;

  if (!isReleaseSectionKey(section)) {
    return {
      title: "Browse | MooSQA",
    };
  }

  const definition = releaseSectionDefinitions[section];
  const url = new URL(`/browse/${section}`, getSiteUrl()).toString();

  return {
    title: `${definition.title} | MooSQA`,
    description: definition.description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `${definition.title} | MooSQA`,
      description: definition.description,
      url,
    },
  };
}

export default async function BrowseSectionPage({
  params,
  searchParams,
}: BrowseSectionPageProps) {
  const { section } = await params;
  if (!isReleaseSectionKey(section)) {
    notFound();
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const page = parsePageParam(resolvedSearchParams.page);

  const archive = await getSectionArchivePage(section, page);
  const syncStatus = await getSyncStatusSummary();

  return (
    <main className="editorial-shell flex-1 px-4 pb-10 pt-4 md:px-8">
      <div className="mx-auto max-w-[1760px] bg-[var(--color-paper)] px-2 md:px-4">
        <SiteHeader />

        <SyncStatusStrip status={syncStatus} className="mt-6" />

        <section className="border-t border-[var(--color-line)] py-10">
          <div className="flex flex-col gap-5 border-b border-[var(--color-soft-line)] pb-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="section-kicker text-black/43">{archive.title}</p>
              <h1 className="mt-3 text-5xl leading-none text-[var(--color-ink)] serif-display md:text-6xl">
                Full archive.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-black/63">
                {archive.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.18em] text-black/55">
              <span className="border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2">
                {archive.total} total posts
              </span>
              <span className="border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2">
                Page {archive.page} / {archive.pageCount}
              </span>
              <Link
                href={`/#${archive.homeId}`}
                className="inline-flex items-center border border-[var(--color-line)] px-3 py-2 transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
              >
                Back to homepage section
              </Link>
            </div>
          </div>

          {archive.releases.length > 0 ? (
            <div className="mt-8 grid gap-8 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
              {archive.releases.map((release, index) => (
                <ReleaseCard
                  key={release.id}
                  release={release}
                  compact={index > 3}
                  priority={index < 2}
                  context={getReleaseCardContext(section)}
                />
              ))}
            </div>
          ) : (
            <div className="mt-8 border border-[var(--color-line)] bg-[var(--color-panel)] p-6 text-sm leading-7 text-black/63">
              {archive.emptyState}
            </div>
          )}

          <ArchivePagination
            section={section}
            page={archive.page}
            pageCount={archive.pageCount}
          />
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}

function ArchivePagination({
  section,
  page,
  pageCount,
}: {
  section: string;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) {
    return null;
  }

  const pageNumbers = getPaginationWindow(page, pageCount);

  return (
    <nav className="mt-10 flex flex-wrap items-center gap-3 border-t border-[var(--color-soft-line)] pt-6 text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink)]">
      {page > 1 ? (
        <Link
          href={`/browse/${section}?page=${page - 1}`}
          prefetch
          scroll={false}
          className="inline-flex items-center border border-[var(--color-line)] px-4 py-3 transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
        >
          Previous
        </Link>
      ) : null}

      {pageNumbers.map((value, index) =>
        value === "ellipsis" ? (
          <span key={`${section}-ellipsis-${index}`} className="px-1 text-black/45">
            ...
          </span>
        ) : (
          <Link
            key={`${section}-${value}`}
            href={`/browse/${section}?page=${value}`}
            prefetch
            scroll={false}
            aria-current={value === page ? "page" : undefined}
            className={
              value === page
                ? "inline-flex min-w-11 items-center justify-center border border-[var(--color-accent-strong)] bg-[var(--color-accent-strong)] px-4 py-3 text-white"
                : "inline-flex min-w-11 items-center justify-center border border-[var(--color-line)] px-4 py-3 transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
            }
          >
            {value}
          </Link>
        ),
      )}

      {page < pageCount ? (
        <Link
          href={`/browse/${section}?page=${page + 1}`}
          prefetch
          scroll={false}
          className="inline-flex items-center border border-[var(--color-line)] px-4 py-3 transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
        >
          Next
        </Link>
      ) : null}
    </nav>
  );
}

function getPaginationWindow(page: number, pageCount: number) {
  const window = new Set<number>([1, pageCount, page - 1, page, page + 1]);
  const pages = [...window].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];

  for (let index = 0; index < pages.length; index += 1) {
    const current = pages[index];
    const previous = pages[index - 1];

    if (previous && current - previous > 1) {
      result.push("ellipsis");
    }

    result.push(current);
  }

  return result;
}

function parsePageParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw || "1");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function getReleaseCardContext(section: string) {
  if (section === "top-rated") {
    return "top-rated" as const;
  }

  if (section === "top-engaged") {
    return "top-engaged" as const;
  }

  return "default" as const;
}
