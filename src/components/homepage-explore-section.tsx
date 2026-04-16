import Link from "next/link";

import { AnalyticsInsightsStrip } from "@/components/analytics-insights-strip";
import { DiscoveryBySceneSection } from "@/components/discovery-by-scene-section";
import { TrendingByGenreSection } from "@/components/trending-by-genre-section";
import { TrendingNowSection } from "@/components/trending-now-section";
import { buildSignalArchiveHref } from "@/lib/archive-links";
import type { ReleaseListingItem, ReleaseSectionKey } from "@/lib/release-sections";

type InsightEntry = {
  release: ReleaseListingItem | null;
  count: number;
};

type HomepageExploreSectionProps = {
  quickLinks: Array<{
    title: string;
    href: string;
  }>;
  trendingArchiveLinks: Array<{
    title: string;
    href: string;
    count: number;
  }>;
  audiencePulse: {
    mostOpenedToday: InsightEntry | null;
    mostSharedThisWeek: InsightEntry | null;
    mostClickedToListen: InsightEntry | null;
    platformHighlights: Array<{
      platform: string;
      entry: InsightEntry | null;
    }>;
  };
  trendingNow: InsightEntry[];
  trendingByGenre: Array<{
    genre: string;
    count: number;
    release: ReleaseListingItem | null;
  }>;
  discoveryScenes: Array<{
    slug: string;
    title: string;
    description: string;
    leadGenre: string;
    count: number;
    release: ReleaseListingItem | null;
  }>;
};

export function HomepageExploreSection({
  quickLinks,
  trendingArchiveLinks,
  audiencePulse,
  trendingNow,
  trendingByGenre,
  discoveryScenes,
}: HomepageExploreSectionProps) {
  const hasSignals =
    Boolean(audiencePulse.mostOpenedToday?.release) ||
    Boolean(audiencePulse.mostSharedThisWeek?.release) ||
    Boolean(audiencePulse.mostClickedToListen?.release) ||
    trendingNow.some((item) => item.release) ||
    trendingByGenre.some((item) => item.release);

  if (!quickLinks.length && !trendingArchiveLinks.length && !hasSignals) {
    return null;
  }

  return (
    <section id="home-discovery" className="border-t border-[var(--color-line)] py-10">
      <details className="group border border-[var(--color-line)] bg-[var(--color-panel)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left">
          <div>
            <p className="section-kicker text-black/43">Discovery map</p>
            <p className="mt-2 text-2xl text-[var(--color-ink)] serif-display">Open discovery tools.</p>
          </div>
          <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent-strong)] transition group-open:rotate-45">
            +
          </span>
        </summary>

        <div className="border-t border-[var(--color-soft-line)] px-5 py-6">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div>
              <p className="max-w-2xl text-sm leading-7 text-black/63">
                Expand the editorial shortcuts only when you want a wider discovery layer beyond the
                main feed.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ExploreGroup title="Radar sections" items={quickLinks} />
              <ExploreGroup title="Trending archives" items={trendingArchiveLinks} showScore />
              <ExploreGroup title="Signal archives" items={buildHomepageSignalLinks()} />
            </div>
          </div>

          <div className="mt-10">
            <AnalyticsInsightsStrip
              mostOpenedToday={audiencePulse.mostOpenedToday}
              mostSharedThisWeek={audiencePulse.mostSharedThisWeek}
              mostClickedToListen={audiencePulse.mostClickedToListen}
              platformHighlights={audiencePulse.platformHighlights}
            />
          </div>

          <TrendingNowSection items={trendingNow} />
          <DiscoveryBySceneSection items={discoveryScenes} />
          <TrendingByGenreSection items={trendingByGenre} />
        </div>
      </details>
    </section>
  );
}

function ExploreGroup({
  title,
  items,
  showScore = false,
}: {
  title: string;
  items: Array<{
    title: string;
    href: string;
    count?: number;
  }>;
  showScore?: boolean;
}) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      <p className="section-kicker text-black/43">{title}</p>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <Link
            key={`${title}-${item.href}-${item.title}`}
            href={item.href}
            prefetch={false}
            className="flex items-center justify-between gap-4 border border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-3 transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
          >
            <span className="text-sm leading-6 text-[var(--color-ink)]">{item.title}</span>
            {showScore && typeof item.count === "number" ? (
              <span className="text-[10px] uppercase tracking-[0.18em] text-black/45">
                {item.count}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function buildHomepageQuickLinks() {
  const items: Array<{ section: ReleaseSectionKey; title: string; href: string }> = [
    { section: "latest", title: "Recent posts", href: "/#latest" },
    { section: "top-rated", title: "Top rated", href: "/#top-rated" },
    { section: "top-engaged", title: "Top engaged on Indieheads", href: "/#top-engaged" },
    { section: "albums", title: "Albums", href: "/#albums" },
    { section: "eps", title: "EPs", href: "/#eps" },
    { section: "live", title: "Live sessions", href: "/#live" },
  ];

  return items;
}

function buildHomepageSignalLinks() {
  return [
    { title: "Most opened today", href: buildSignalArchiveHref("opened", 1, "today") },
    { title: "Most shared this week", href: buildSignalArchiveHref("shared", 1, "7d") },
    { title: "Most clicked to listen", href: buildSignalArchiveHref("listened", 1, "7d") },
    { title: "Most liked", href: buildSignalArchiveHref("liked", 1, "7d") },
    { title: "Most disliked", href: buildSignalArchiveHref("disliked", 1, "7d") },
    { title: "Most discussed", href: buildSignalArchiveHref("discussed", 1, "7d") },
  ];
}
