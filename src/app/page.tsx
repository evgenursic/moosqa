import type { Metadata } from "next";

import { ReleaseCard } from "@/components/release-card";
import { ReleaseExplorer } from "@/components/release-explorer";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ReleaseType } from "@/generated/prisma/enums";
import { dedupeReleasesForDisplay } from "@/lib/display-dedupe";
import { getSiteUrl } from "@/lib/site";
import { getHomepageData, refreshHomepageData } from "@/lib/sync-releases";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

export default async function Home({ searchParams }: HomePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const hasSearchResults = Boolean(
    getSearchParamValue(resolvedSearchParams.q) ||
      getSearchParamValue(resolvedSearchParams.type) ||
      getSearchParamValue(resolvedSearchParams.platform) ||
      getSearchParamValue(resolvedSearchParams.direct),
  );
  await refreshHomepageData();
  const { releases, performances } = await getHomepageData();
  const displayReleases = dedupeReleasesForDisplay(releases);
  const displayPerformances = dedupeReleasesForDisplay(performances);

  const latestReleases = displayReleases.slice(0, 15);
  const rankedStories = [...displayReleases]
    .filter((release) => release.scoreCount > 0)
    .sort((left, right) => right.scoreAverage - left.scoreAverage)
    .slice(0, 8);
  const topRated = rankedStories.length > 0 ? rankedStories : displayReleases.slice(0, 8);
  const topEngaged = [...displayReleases]
    .sort((left, right) => getEngagementScore(right) - getEngagementScore(left))
    .slice(0, 8);
  const albumReleases = displayReleases
    .filter((release) => release.releaseType === ReleaseType.ALBUM)
    .slice(0, 12);
  const epReleases = displayReleases
    .filter((release) => release.releaseType === ReleaseType.EP)
    .slice(0, 12);
  const liveReleases = displayPerformances.slice(0, 12);

  return (
    <main className="editorial-shell flex-1 px-4 pb-10 pt-4 md:px-8">
      <div className="mx-auto max-w-[1760px] bg-[var(--color-paper)] px-2 md:px-4">
        <SiteHeader />

        {hasSearchResults ? (
          <ReleaseExplorer
            releases={displayReleases.map((release) => ({
              ...release,
              summary: release.summary,
              publishedAt: release.publishedAt.toISOString(),
            }))}
          />
        ) : null}

        <section id="latest" className="py-10">
          <div className="mb-8">
            <p className="section-kicker text-black/43">Latest posts</p>
            <h1 className="mt-3 text-6xl leading-none text-[var(--color-ink)] serif-display">
              New releases first.
            </h1>
          </div>

          {latestReleases.length > 0 ? (
            <div className="grid gap-8 lg:grid-cols-12">
              {latestReleases[0] ? (
                <div className="lg:col-span-6">
                  <ReleaseCard release={latestReleases[0]} priority />
                </div>
              ) : null}

              {latestReleases[1] ? (
                <div className="lg:col-span-3">
                  <ReleaseCard release={latestReleases[1]} />
                </div>
              ) : null}

              {latestReleases[2] ? (
                <div className="lg:col-span-3">
                  <ReleaseCard release={latestReleases[2]} />
                </div>
              ) : null}
            </div>
          ) : null}

          {latestReleases.length > 3 ? (
            <div className="mt-10 grid gap-8 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
              {latestReleases.slice(3).map((release) => (
                <ReleaseCard key={release.id} release={release} />
              ))}
            </div>
          ) : null}
        </section>

        <ReleaseCardSection
          id="top-rated"
          title="Top rated"
          releases={topRated}
        />

        <ReleaseCardSection
          id="top-engaged"
          title="Top engaged on Indieheads"
          releases={topEngaged}
        />

        <ReleaseCardSection
          id="albums"
          title="Albums"
          releases={albumReleases}
        />

        <ReleaseCardSection
          id="eps"
          title="EPs"
          releases={epReleases}
        />

        <ReleaseCardSection
          id="performances"
          title="Live performances"
          releases={liveReleases}
        />

        <SiteFooter />
      </div>
    </main>
  );
}

function getSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value || "";
}

function getEngagementScore(release: {
  score: number | null;
  commentCount: number | null;
}) {
  return (release.commentCount ?? 0) * 4 + (release.score ?? 0);
}

type ReleaseCardSectionProps = {
  id: string;
  title: string;
  releases: Array<{
    id: string;
    slug: string;
    title: string;
    artistName: string | null;
    projectTitle: string | null;
    releaseType: ReleaseType;
    imageUrl: string | null;
    thumbnailUrl?: string | null;
    outletName: string | null;
    sourceUrl: string;
    youtubeUrl?: string | null;
    youtubeMusicUrl?: string | null;
    bandcampUrl?: string | null;
    labelName?: string | null;
    genreName?: string | null;
    aiSummary?: string | null;
    publishedAt: Date;
    scoreAverage: number;
    scoreCount: number;
  }>;
};

function ReleaseCardSection({ id, title, releases }: ReleaseCardSectionProps) {
  if (releases.length === 0) {
    return null;
  }

  return (
    <section id={id} className="border-t border-[var(--color-line)] py-10">
      <div className="mb-8">
        <p className="section-kicker text-black/43">{title}</p>
      </div>

      <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
        {releases.map((release, index) => (
          <ReleaseCard
            key={release.id}
            release={release}
            compact={index > 1}
            priority={index < 2}
          />
        ))}
      </div>
    </section>
  );
}
