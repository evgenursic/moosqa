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
import { buildSceneArchiveHref, buildTrendingGenreHref } from "@/lib/archive-links";
import { getSceneArchivePage } from "@/lib/analytics";
import { getSceneDefinitionBySlug, isDiscoverySceneSlug } from "@/lib/discovery-scenes";
import { getSiteUrl } from "@/lib/site";

type SceneArchivePageProps = {
  params: Promise<{
    scene: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
  searchParams,
}: SceneArchivePageProps): Promise<Metadata> {
  const { scene } = await params;
  if (!isDiscoverySceneSlug(scene)) {
    return {
      title: "Discovery scenes | MooSQA",
    };
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const page = parsePageParam(resolvedSearchParams.page);
  const definition = getSceneDefinitionBySlug(scene);
  if (!definition) {
    return {
      title: "Discovery scenes | MooSQA",
    };
  }

  const title = `${definition.title}${page > 1 ? ` | Page ${page}` : ""} | MooSQA`;
  const description = `${definition.description} Open the full MooSQA scene archive and follow the genres currently driving it.`;
  const canonicalUrl = new URL(buildSceneArchiveHref(scene, page), getSiteUrl()).toString();
  const socialImage = new URL(`/scene/${scene}/opengraph-image`, getSiteUrl()).toString();

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
    },
  };
}

export default function SceneArchivePage({
  params,
  searchParams,
}: SceneArchivePageProps) {
  return (
    <Suspense fallback={<SceneArchiveShell />}>
      <SceneArchiveContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function SceneArchiveContent({
  params,
  searchParams,
}: SceneArchivePageProps) {
  await connection();
  const { scene } = await params;
  if (!isDiscoverySceneSlug(scene)) {
    notFound();
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const page = parsePageParam(resolvedSearchParams.page);
  const archive = await getSceneArchivePage(scene, page);

  if (!archive) {
    notFound();
  }

  const canonicalHref = buildSceneArchiveHref(scene, archive.page);

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
              <p className="mt-4 max-w-3xl text-sm leading-7 text-black/63">{archive.description}</p>
            </div>

            <div className="flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.18em] text-black/55">
              <span className="border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2">
                {archive.total} matching posts
              </span>
              <span className="border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2">
                Page {archive.page} / {archive.pageCount}
              </span>
              <ShareFilterLink href={canonicalHref} label={`${archive.title} scene archive`} />
            </div>
          </div>

          {archive.matchedGenres.length > 0 ? (
            <div className="mt-6 flex flex-wrap gap-2 border-b border-[var(--color-soft-line)] pb-6 text-[11px] uppercase tracking-[0.18em]">
              {archive.matchedGenres.map((genre) => (
                <Link
                  key={`${scene}-${genre}`}
                  href={buildTrendingGenreHref(genre)}
                  prefetch={false}
                  className="inline-flex items-center border border-[var(--color-line)] px-3 py-2 text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
                >
                  {genre}
                </Link>
              ))}
            </div>
          ) : null}

          {archive.entries.length > 0 ? (
            <div className="mt-8 grid gap-8 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
              {archive.entries.map((entry, index) => (
                <div key={`${scene}-${entry.release.id}`} className="border-t border-[var(--color-line)] pt-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="section-kicker text-black/43">#{index + 1}</p>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent-strong)]">
                      {Math.round(entry.score)} scene score
                    </p>
                  </div>
                  <ReleaseCard
                    release={entry.release}
                    compact={index > 3}
                    priority={index < 2}
                    fromHref={`${canonicalHref}#archive`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-8 border border-[var(--color-line)] bg-[var(--color-panel)] p-6 text-sm leading-7 text-black/63">
              No matching scene releases are available yet.
            </div>
          )}

          <ArchivePagination
            page={archive.page}
            pageCount={archive.pageCount}
            buildHref={(nextPage) => buildSceneArchiveHref(scene, nextPage)}
          />
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}

function SceneArchiveShell() {
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

function parsePageParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw || "1");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
