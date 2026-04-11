import type { Metadata } from "next";
import Link from "next/link";
import { after, connection } from "next/server";
import { Suspense } from "react";

import { FeedFreshness } from "@/components/feed-freshness";
import { HomepageGenreFilter } from "@/components/homepage-genre-filter";
import { ReleaseCard } from "@/components/release-card";
import { ReleaseExplorer } from "@/components/release-explorer";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  getHomepageSectionsData,
  getSearchReleases,
  type ReleaseListingItem,
  type ReleaseSectionKey,
  releaseSectionDefinitions,
} from "@/lib/release-sections";
import { getHomepageGenreFilters } from "@/lib/search-overlay";
import { getSiteUrl } from "@/lib/site";
import {
  getSyncStatusSummary,
  refreshHomepageData,
  shouldBlockForHomepageRefresh,
} from "@/lib/sync-releases";

export const metadata: Metadata = {
  title: "Music Radar",
  description:
    "Track fresh indie singles, albums, EPs and live sessions with a fast editorial feed built around r/indieheads discoveries.",
  alternates: {
    canonical: getSiteUrl(),
  },
  openGraph: {
    title: "MooSQA | Music Radar",
    description:
      "Track fresh indie singles, albums, EPs and live sessions with a fast editorial feed built around r/indieheads discoveries.",
    url: getSiteUrl(),
  },
};

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default function Home({ searchParams }: HomePageProps) {
  return (
    <main className="editorial-shell flex-1 px-4 pb-10 pt-4 md:px-8">
      <div className="mx-auto max-w-[1760px] bg-[var(--color-paper)] px-2 md:px-4">
        <SiteHeader />
        <Suspense fallback={<HomePageSkeleton />}>
          <HomeContent searchParams={searchParams} />
        </Suspense>
        <SiteFooter />
      </div>
    </main>
  );
}

async function HomeContent({ searchParams }: HomePageProps) {
  await connection();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const hasSearchResults = Boolean(
    getSearchParamValue(resolvedSearchParams.q) ||
      getSearchParamValue(resolvedSearchParams.type) ||
      getSearchParamValue(resolvedSearchParams.genre) ||
      getSearchParamValue(resolvedSearchParams.platform) ||
      getSearchParamValue(resolvedSearchParams.direct),
  );
  const selectedGenre = getSearchParamValue(resolvedSearchParams.genre);
  const shouldWaitForRefresh = await shouldBlockForHomepageRefresh();

  if (shouldWaitForRefresh) {
    await refreshHomepageData();
  }

  after(async () => {
    await refreshHomepageData();
  });

  let [sections, searchReleases, syncStatus, homepageGenres] = await Promise.all([
    getHomepageSectionsData(),
    hasSearchResults ? getSearchReleases() : Promise.resolve([] as ReleaseListingItem[]),
    getSyncStatusSummary(),
    getHomepageGenreFilters(),
  ]);

  if (sections.latest.length === 0) {
    await refreshHomepageData();

    [sections, searchReleases, syncStatus, homepageGenres] = await Promise.all([
      getHomepageSectionsData(),
      hasSearchResults
        ? getSearchReleases({ useCache: false, ttlMs: 0 })
        : Promise.resolve([] as ReleaseListingItem[]),
      getSyncStatusSummary(),
      getHomepageGenreFilters(),
    ]);
  }

  const latestReleases = sections.latest;

  return (
    <>
      <FeedFreshness summary={syncStatus} className="mt-4" />
      <HomepageGenreFilter genres={homepageGenres} selectedGenre={selectedGenre} />

      {hasSearchResults ? (
        <ReleaseExplorer
          releases={searchReleases.map((release) => ({
            ...release,
            summary: release.summary,
            publishedAt: release.publishedAt.toISOString(),
          }))}
        />
      ) : null}

      <section id="latest" className="scroll-mt-32 py-10 md:scroll-mt-40 lg:scroll-mt-52">
        <div className="mb-8">
          <p className="section-kicker text-black/43">Recent posts</p>
          <h1 className="mt-3 text-6xl leading-none text-[var(--color-ink)] serif-display">
            New releases first.
          </h1>
        </div>

        {latestReleases.length > 0 ? (
          <div className="grid gap-8 lg:grid-cols-12">
            {latestReleases[0] ? (
              <div className="lg:col-span-6">
                <ReleaseCard release={latestReleases[0]} priority fromHref="/#latest" />
              </div>
            ) : null}

            {latestReleases[1] ? (
              <div className="lg:col-span-3">
                <ReleaseCard release={latestReleases[1]} fromHref="/#latest" />
              </div>
            ) : null}

            {latestReleases[2] ? (
              <div className="lg:col-span-3">
                <ReleaseCard release={latestReleases[2]} fromHref="/#latest" />
              </div>
            ) : null}
          </div>
        ) : null}

        {latestReleases.length > 3 ? (
          <div className="mt-10 grid gap-8 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
            {latestReleases.slice(3).map((release) => (
              <ReleaseCard key={release.id} release={release} fromHref="/#latest" />
            ))}
          </div>
        ) : null}

        <SectionReadMore section="latest" className="mt-8" />
      </section>

      <ReleaseCardSection section="top-rated" releases={sections.topRated} />
      <ReleaseCardSection section="top-engaged" releases={sections.topEngaged} />
      <ReleaseCardSection section="albums" releases={sections.albums} />
      <ReleaseCardSection section="eps" releases={sections.eps} />
      <ReleaseCardSection section="live" releases={sections.live} />
    </>
  );
}

function HomePageSkeleton() {
  return (
    <>
      <div className="mt-4 h-5 w-40 animate-pulse bg-[var(--color-panel)]" />
      <div className="mt-5 h-24 animate-pulse border-t border-[var(--color-line)] bg-[var(--color-panel)]" />

      <section className="scroll-mt-32 py-10 md:scroll-mt-40 lg:scroll-mt-52">
        <div className="mb-8">
          <p className="section-kicker text-black/43">Recent posts</p>
          <h1 className="mt-3 text-6xl leading-none text-[var(--color-ink)] serif-display">
            New releases first.
          </h1>
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          <div className="border-t border-[var(--color-line)] pt-6 lg:col-span-6">
            <div className="aspect-[4/3] animate-pulse border border-[var(--color-line)] bg-[var(--color-panel)]" />
          </div>
          <div className="border-t border-[var(--color-line)] pt-6 lg:col-span-3">
            <div className="aspect-[4/3] animate-pulse border border-[var(--color-line)] bg-[var(--color-panel)]" />
          </div>
          <div className="border-t border-[var(--color-line)] pt-6 lg:col-span-3">
            <div className="aspect-[4/3] animate-pulse border border-[var(--color-line)] bg-[var(--color-panel)]" />
          </div>
        </div>
      </section>
    </>
  );
}

function getSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value || "";
}

type ReleaseCardSectionProps = {
  section: ReleaseSectionKey;
  releases: ReleaseListingItem[];
};

function ReleaseCardSection({ section, releases }: ReleaseCardSectionProps) {
  const definition = releaseSectionDefinitions[section];

  return (
    <section
      id={definition.homeId}
      className="scroll-mt-32 border-t border-[var(--color-line)] py-10 md:scroll-mt-40 lg:scroll-mt-52"
    >
      <div className="mb-8">
        <p className="section-kicker text-black/43">{definition.title}</p>
      </div>

      {releases.length > 0 ? (
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
          {releases.map((release, index) => (
            <ReleaseCard
              key={release.id}
              release={release}
              compact={index > 1}
              priority={index < 2}
              context={getReleaseCardContext(section)}
              fromHref={`/#${definition.homeId}`}
            />
          ))}
        </div>
      ) : (
        <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-6 text-sm leading-7 text-black/63">
          {definition.emptyState}
        </div>
      )}

      <SectionReadMore section={section} className="mt-8" />
    </section>
  );
}

function getReleaseCardContext(section: ReleaseSectionKey) {
  if (section === "top-rated") {
    return "top-rated" as const;
  }

  if (section === "top-engaged") {
    return "top-engaged" as const;
  }

  return "default" as const;
}

function SectionReadMore({
  section,
  className,
}: {
  section: ReleaseSectionKey;
  className?: string;
}) {
  const definition = releaseSectionDefinitions[section];

  return (
    <div className={className}>
      <Link
        href={`/browse/${section}`}
        className="inline-flex items-center border border-[var(--color-line)] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
      >
        {definition.readMoreLabel}
      </Link>
    </div>
  );
}
