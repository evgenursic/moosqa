import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { ArchivePagination } from "@/components/archive-pagination";
import { GenreFilterDrawer } from "@/components/genre-filter-drawer";
import { PageScrollRestorer } from "@/components/page-scroll-restorer";
import { ReleaseCard } from "@/components/release-card";
import { ShareFilterLink } from "@/components/share-filter-link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { buildTrendingGenreHref, slugifyGenre } from "@/lib/archive-links";
import { getSectionArchivePageLightweight, getSearchGenreFacets } from "@/lib/release-sections";
import { getSiteUrl } from "@/lib/site";
import { refreshHomepageData, shouldBlockForHomepageRefresh } from "@/lib/sync-releases";

type TrendingGenrePageProps = {
  params: Promise<{
    genre: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
  searchParams,
}: TrendingGenrePageProps): Promise<Metadata> {
  const { genre: genreSlug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const page = parsePageParam(resolvedSearchParams.page);
  const titleGenre = deslugifyGenre(genreSlug);
  const title = `Trending ${titleGenre}${page > 1 ? ` | Page ${page}` : ""} | MooSQA`;
  const description = `Open the MooSQA trending feed for ${titleGenre}, ranked by audience opens, listening clicks, shares, and reactions.`;
  const canonicalUrl = new URL(
    page > 1 ? `${buildTrendingGenreHref(genreSlug)}?page=${page}` : `/trending/${genreSlug}`,
    getSiteUrl(),
  ).toString();

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
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function TrendingGenrePage({
  params,
  searchParams,
}: TrendingGenrePageProps) {
  return (
    <Suspense fallback={<TrendingGenreShell />}>
      <TrendingGenreContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function TrendingGenreContent({
  params,
  searchParams,
}: TrendingGenrePageProps) {
  await connection();
  const { genre: genreSlug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const page = parsePageParam(resolvedSearchParams.page);

  const [allGenres, shouldWaitForRefresh] = await Promise.all([
    getSearchGenreFacets(),
    shouldBlockForHomepageRefresh(),
  ]);

  if (shouldWaitForRefresh) {
    try {
      await refreshHomepageData();
    } catch (error) {
      console.error(`Trending genre refresh failed for ${genreSlug}. Continuing with cached data.`, error);
    }
  }

  const matchedGenre =
    allGenres.find((genre) => slugifyGenre(genre) === genreSlug) || null;

  if (!matchedGenre) {
    notFound();
  }

  const archive = await getSectionArchivePageLightweight("top-engaged", page, matchedGenre, "trending");
  const canonicalHref = page > 1 ? `${buildTrendingGenreHref(matchedGenre)}?page=${archive.page}` : buildTrendingGenreHref(matchedGenre);

  return (
    <main className="editorial-shell flex-1 px-4 pb-10 pt-4 md:px-8">
      <div className="mx-auto max-w-[1760px] bg-[var(--color-paper)] px-2 md:px-4">
        <SiteHeader />
        <PageScrollRestorer />

        <section className="border-t border-[var(--color-line)] py-10">
          <div className="flex flex-col gap-5 border-b border-[var(--color-soft-line)] pb-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="section-kicker text-black/43">Trending genre</p>
              <h1 className="mt-3 text-5xl leading-none text-[var(--color-ink)] serif-display md:text-6xl">
                {matchedGenre}.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-black/63">
                Direct landing feed for the strongest {matchedGenre.toLowerCase()} audience momentum
                across recent Indieheads posts.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.18em] text-black/55">
              <span className="border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2">
                {archive.total} matching posts
              </span>
              <span className="border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2">
                Page {archive.page} / {archive.pageCount}
              </span>
              <LinkBackToTrending />
              <ShareFilterLink href={canonicalHref} label={`${matchedGenre} trending feed`} />
            </div>
          </div>

          <GenreFilterDrawer
            title="Trending genres"
            description="Open a dedicated public landing feed for the genre you want to track."
            selectedGenre={matchedGenre}
            allHref="/browse/top-engaged?view=trending"
            options={allGenres.map((genre) => ({
              label: genre,
              href: buildTrendingGenreHref(genre),
            }))}
            className="mt-6 border-b border-[var(--color-soft-line)] pb-6"
            searchPlaceholder="Open a trending genre feed"
            compact
          />

          {archive.releases.length > 0 ? (
            <div className="mt-8 grid gap-8 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
              {archive.releases.map((release, index) => (
                <ReleaseCard
                  key={release.id}
                  release={release}
                  compact={index > 3}
                  priority={index < 2}
                  context="top-engaged"
                  fromHref={`${canonicalHref}#archive`}
                />
              ))}
            </div>
          ) : (
            <div className="mt-8 border border-[var(--color-line)] bg-[var(--color-panel)] p-6 text-sm leading-7 text-black/63">
              No trending releases are available for this genre yet.
            </div>
          )}

          <ArchivePagination
            page={archive.page}
            pageCount={archive.pageCount}
            buildHref={(nextPage) =>
              nextPage > 1
                ? `${buildTrendingGenreHref(matchedGenre)}?page=${nextPage}`
                : buildTrendingGenreHref(matchedGenre)
            }
          />
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}

function TrendingGenreShell() {
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

function LinkBackToTrending() {
  return (
    <Link
      href="/browse/top-engaged?view=trending"
      className="inline-flex items-center border border-[var(--color-line)] px-3 py-2 transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
    >
      All trending
    </Link>
  );
}

function parsePageParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw || "1");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function deslugifyGenre(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
