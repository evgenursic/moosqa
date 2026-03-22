import Link from "next/link";

import { AdvancedSearchButton, AdvancedSearchPanel } from "@/components/advanced-search";
import { HeroFeature } from "@/components/hero-feature";
import { ReleaseBrief } from "@/components/release-brief";
import { ReleaseCard } from "@/components/release-card";
import { ReleaseExplorer } from "@/components/release-explorer";
import { getListeningLinks } from "@/lib/listening-links";
import { getHomepageData, refreshHomepageData } from "@/lib/sync-releases";

export const dynamic = "force-dynamic";

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
  const { featured, releases, albums, performances, stats } = await getHomepageData();

  const sideStories = releases
    .filter((release) => release.id !== featured?.id)
    .slice(0, 6);
  const leadSideStories = sideStories.slice(0, 2);
  const sideBriefs = sideStories.slice(2);
  const heroFillers = releases
    .filter(
      (release) => release.id !== featured?.id && !sideStories.some((item) => item.id === release.id),
    )
    .slice(0, 8);
  const heroFeatureSupport = heroFillers.slice(0, 2);
  const heroSupportBriefs = heroFillers.slice(2);

  const featuredIds = new Set([
    featured?.id,
    ...sideStories.map((release) => release.id),
    ...heroFillers.map((release) => release.id),
  ]);
  const storyStream = releases.filter((release) => !featuredIds.has(release.id)).slice(0, 12);
  const rankedStories = [...releases]
    .filter((release) => release.scoreCount > 0)
    .sort((left, right) => right.scoreAverage - left.scoreAverage)
    .slice(0, 5);
  const topRated = rankedStories.length > 0 ? rankedStories : releases.slice(0, 5);
  const justIn = releases.slice(0, 6);
  const listenNow = releases.filter(hasWorkingLink).slice(0, 6);
  const albumRadar = albums.slice(0, 6);

  return (
    <main className="editorial-shell flex-1 px-4 pb-10 pt-4 md:px-8">
      <div className="mx-auto max-w-[1760px] bg-[var(--color-paper)] px-2 md:px-4">
        <header className="border-b border-[var(--color-line)] py-8">
          <div className="grid items-start gap-8 lg:grid-cols-[1fr_auto_1fr]">
            <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm uppercase tracking-[0.18em] text-[var(--color-ink)]">
              <a href="#latest">Latest</a>
              <a href="#albums">Albums + EPs</a>
              <a href="#performances">Performances</a>
              <AdvancedSearchButton className="inline-flex items-center justify-center transition hover:opacity-70" />
              <a href="https://www.reddit.com/r/indieheads/" target="_blank" rel="noreferrer">
                Indieheads
              </a>
            </nav>

            <div className="text-center">
              <Link href="/" className="inline-block">
                <p className="text-6xl leading-none text-[var(--color-ink)] serif-display md:text-7xl">MooSQA</p>
                <p className="mt-2 text-xs uppercase tracking-[0.65em] text-black/60">Music Radar</p>
              </Link>
            </div>

            <div className="flex flex-wrap justify-start gap-x-8 gap-y-3 text-sm uppercase tracking-[0.18em] text-[var(--color-ink)] lg:justify-end">
              <a href="#latest">Tracks</a>
              <a href="#albums">Albums</a>
              <a href="#top-rated">Community score</a>
              <AdvancedSearchButton className="inline-flex items-center justify-center transition hover:opacity-70" />
              <a href="#listen-free">Listen free</a>
            </div>
          </div>

          <AdvancedSearchPanel />

          <div className="mt-8 grid gap-6 border-t border-[var(--color-line)] pt-6 lg:grid-cols-[1.3fr_0.7fr]">
            <p className="max-w-4xl text-2xl leading-tight text-[var(--color-ink)] serif-display md:text-[2.4rem]">
              An editorial front page for fresh indie releases, updated from r/indieheads and built for immediate listening on YouTube, YouTube Music, and Bandcamp.
            </p>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
                <p className="section-kicker text-black/40">Stories</p>
                <p className="mt-3 text-4xl text-[var(--color-ink)] serif-display">{stats.total}</p>
              </div>
              <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
                <p className="section-kicker text-black/40">Singles</p>
                <p className="mt-3 text-4xl text-[var(--color-ink)] serif-display">{stats.singlesToday}</p>
              </div>
              <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
                <p className="section-kicker text-black/40">Albums</p>
                <p className="mt-3 text-4xl text-[var(--color-ink)] serif-display">{stats.albumsThisWeek}</p>
              </div>
              <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
                <p className="section-kicker text-black/40">Avg score</p>
                <p className="mt-3 text-4xl text-[var(--color-ink)] serif-display">
                  {Number.isFinite(stats.avgScore) ? Math.round(stats.avgScore) : 0}%
                </p>
              </div>
            </div>
          </div>
        </header>

        {hasSearchResults ? (
          <ReleaseExplorer
            releases={releases.map((release) => ({
              ...release,
              summary: release.summary,
              publishedAt: release.publishedAt.toISOString(),
            }))}
          />
        ) : null}

        <div className="story-grid gap-y-12 py-10">
          <div className="space-y-8">
            {featured ? <HeroFeature release={featured} /> : null}

            {heroFillers.length > 0 ? (
              <section className="grid gap-8 border-b border-[var(--color-line)] pb-10 lg:grid-cols-[1.06fr_0.94fr]">
                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {heroFeatureSupport.map((release) => (
                    <ReleaseCard key={release.id} release={release} compact />
                  ))}
                </div>

                <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
                  <div className="flex flex-col gap-3 border-b border-[var(--color-line)] pb-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="section-kicker text-black/43">Continue browsing</p>
                      <h2 className="mt-3 text-4xl leading-none text-[var(--color-ink)] serif-display">
                        More releases without the empty gap.
                      </h2>
                    </div>
                    <p className="max-w-[13rem] text-[11px] uppercase tracking-[0.18em] text-black/45">
                      Fresh picks, fast links, and more artwork directly under the lead story.
                    </p>
                  </div>

                  <div className="mt-5 space-y-4">
                    {heroSupportBriefs.map((release) => (
                      <ReleaseBrief key={release.id} release={release} emphasis="listen" />
                    ))}
                  </div>
                </div>
              </section>
            ) : null}
          </div>

          <aside className="space-y-6 border-l border-[var(--color-line)] pl-0 lg:pl-8">
            {leadSideStories.map((release) => (
              <ReleaseCard key={release.id} release={release} compact />
            ))}

            {sideBriefs.length > 0 ? (
              <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
                <p className="section-kicker text-black/43">More new releases</p>
                <div className="mt-4 space-y-4">
                  {sideBriefs.map((release) => (
                    <ReleaseBrief key={release.id} release={release} emphasis="listen" />
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        </div>

        <section className="border-t border-[var(--color-line)] py-10" id="listen-free">
          <div className="grid gap-8 xl:grid-cols-2 2xl:grid-cols-4">
            <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-5" id="top-rated">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="section-kicker text-black/43">Direct listening</p>
                  <h2 className="mt-3 text-4xl leading-none text-[var(--color-ink)] serif-display">
                    Working links first.
                  </h2>
                </div>
                <p className="max-w-[11rem] text-[11px] uppercase tracking-[0.18em] text-black/45">
                  Highlighted buttons open the actual page immediately.
                </p>
              </div>

              <div className="mt-6 space-y-4">
                {listenNow.map((release) => (
                  <ReleaseBrief key={release.id} release={release} emphasis="listen" />
                ))}
              </div>
            </div>

            <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
              <p className="section-kicker text-black/43">Album radar</p>
              <h2 className="mt-3 text-4xl leading-none text-[var(--color-ink)] serif-display">
                Longer releases in view.
              </h2>

              <div className="mt-6 space-y-4">
                {albumRadar.map((release) => (
                  <ReleaseBrief key={release.id} release={release} />
                ))}
              </div>
            </div>

            <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
              <p className="section-kicker text-black/43">Top rated</p>
              <h2 className="mt-3 text-4xl leading-none text-[var(--color-ink)] serif-display">
                Listener favorites right now.
              </h2>

              <div className="mt-6 space-y-4">
                {topRated.map((release) => (
                  <ReleaseBrief key={release.id} release={release} emphasis="score" />
                ))}
              </div>
            </div>

            <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
              <p className="section-kicker text-black/43">Just in</p>
              <h2 className="mt-3 text-4xl leading-none text-[var(--color-ink)] serif-display">
                The newest arrivals.
              </h2>

              <div className="mt-6 space-y-4">
                {justIn.map((release) => (
                  <ReleaseBrief key={release.id} release={release} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="latest" className="border-t border-[var(--color-line)] py-10">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="section-kicker text-black/43">Latest stream</p>
              <h2 className="mt-3 text-6xl leading-none text-[var(--color-ink)] serif-display">Fresh singles and immediate clicks.</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-black/62">
              The stream is organized like an editorial grid rather than a feed dump: cover first, title second, listening actions and score directly underneath.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
            {storyStream.map((release, index) => (
              <ReleaseCard key={release.id} release={release} priority={index < 2} />
            ))}
          </div>
        </section>

        <section id="albums" className="border-t border-[var(--color-line)] py-10">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="section-kicker text-black/43">Friday watch</p>
              <h2 className="mt-3 text-6xl leading-none text-[var(--color-ink)] serif-display">Albums and EPs worth checking first.</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-black/62">
              This rail is meant for weekly album drops and longer-form releases, matching the way listeners scan Friday updates.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {albums.slice(0, 12).map((release, index) => (
              <ReleaseCard key={release.id} release={release} compact={index > 1} />
            ))}
          </div>
        </section>

        <section id="performances" className="border-t border-[var(--color-line)] py-10">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="section-kicker text-black/43">Performance desk</p>
              <h2 className="mt-3 text-6xl leading-none text-[var(--color-ink)] serif-display">Live sessions, TV spots, and one-off footage.</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-black/62">
              Performance posts stay visible instead of being buried in the main stream, which makes the page more useful for discovery and repeat visits.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
            {performances.slice(0, 12).map((release) => (
              <ReleaseCard key={release.id} release={release} compact />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function hasWorkingLink(release: Parameters<typeof getListeningLinks>[0]) {
  return getListeningLinks(release).some((link) => link.isDirect);
}

function getSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value || "";
}
