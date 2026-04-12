import Link from "next/link";

import { getPublicAnalyticsInsights } from "@/lib/analytics";
import { buildArchiveHref } from "@/lib/archive-links";

type FooterLink = {
  href: string;
  label: string;
  external?: boolean;
};

type FooterColumn = {
  title: string;
  links: FooterLink[];
};

const footerColumns: FooterColumn[] = [
  {
    title: "Radar",
    links: [
      { href: "/#latest", label: "Latest posts" },
      { href: "/#top-rated", label: "Top rated" },
      { href: "/#top-engaged", label: "Top engaged" },
    ],
  },
  {
    title: "Releases",
    links: [
      { href: "/#albums", label: "Albums" },
      { href: "/#eps", label: "EPs" },
      { href: "/#live", label: "Live sessions" },
    ],
  },
  {
    title: "Source",
    links: [
      { href: "https://www.reddit.com/r/indieheads/", label: "r/indieheads", external: true },
      { href: "/sitemap.xml", label: "Sitemap" },
      { href: "/robots.txt", label: "Robots" },
    ],
  },
];

const COPYRIGHT_YEAR = 2026;

export async function SiteFooter() {
  let analyticsInsights: Awaited<ReturnType<typeof getPublicAnalyticsInsights>> | null = null;

  try {
    analyticsInsights = await getPublicAnalyticsInsights();
  } catch (error) {
    console.error("Footer analytics insights failed to load.", error);
  }

  return (
    <footer className="mt-16 border-t border-[var(--color-line)] bg-[#17181d] text-white">
      <div className="mx-auto max-w-[1760px] px-6 py-10 md:px-8 lg:px-10 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)]">
          <div>
            <Link href="/" prefetch={false} className="inline-block">
              <p className="text-5xl leading-none text-white serif-display md:text-6xl">MooSQA</p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.42em] text-white/58">
                Music Radar
              </p>
            </Link>

            <p className="mt-6 max-w-xl text-sm leading-7 text-white/70">
              Fast indie release discovery built around the latest posts from r/indieheads,
              cleaned into a readable editorial beta for listeners who want new music quickly.
            </p>

            {analyticsInsights?.trendingArchiveLinks?.length ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {analyticsInsights.trendingArchiveLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    className="inline-flex items-center border border-white/12 bg-white/[0.03] px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-white/78 transition hover:border-white/28 hover:text-white"
                  >
                    {item.title}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {footerColumns.map((column) => (
              <div key={column.title}>
                <p className="section-kicker text-white/48">{column.title}</p>
                <div className="mt-4 grid gap-3 text-sm uppercase tracking-[0.16em] text-white/82">
                  {column.links.map((link) =>
                    link.external ? (
                      <a key={link.label} href={link.href} target="_blank" rel="noreferrer">
                        {link.label}
                      </a>
                    ) : (
                      <Link key={link.label} href={link.href} prefetch={false}>
                        {link.label}
                      </Link>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {analyticsInsights ? (
          <div className="mt-10 grid gap-8 border-t border-white/12 pt-8 lg:grid-cols-3">
            <FooterResultColumn
              title="Audience pulse"
              items={analyticsInsights.audiencePulseLinks.map((item) => ({
                href: item.release ? `/releases/${item.release.slug}` : "/",
                label: item.release ? getReleaseLabel(item.release) : item.title,
                meta: `${item.count} actions`,
              }))}
            />
            <FooterResultColumn
              title="Trending now"
              items={analyticsInsights.trendingNow.slice(0, 4).map((item) => ({
                href: item.release ? `/releases/${item.release.slug}` : buildArchiveHref("top-engaged", { view: "trending" }),
                label: item.release ? getReleaseLabel(item.release) : "Open trending feed",
                meta: `${item.count} trend score`,
              }))}
            />
            <FooterResultColumn
              title="Trending by genre"
              items={analyticsInsights.trendingGenreLinks.map((item) => ({
                href: item.href,
                label: item.title,
                meta: `${item.count} genre score`,
              }))}
            />
          </div>
        ) : null}

        <div className="mt-10 border-t border-white/12 pt-5 text-[11px] uppercase tracking-[0.16em] text-white/46 md:flex md:items-center md:justify-between">
          <p>&copy; {COPYRIGHT_YEAR} MooSQA beta</p>
          <p className="mt-3 md:mt-0">
            Editorial discovery feed for new singles, albums, EPs, and live sessions.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterResultColumn({
  title,
  items,
}: {
  title: string;
  items: Array<{
    href: string;
    label: string;
    meta: string;
  }>;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="section-kicker text-white/48">{title}</p>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <Link
            key={`${title}-${item.href}-${item.label}`}
            href={item.href}
            prefetch={false}
            className="border border-white/12 bg-white/[0.03] px-4 py-3 transition hover:border-white/26 hover:bg-white/[0.05]"
          >
            <p className="text-sm leading-6 text-white/88">{item.label}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/46">{item.meta}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function getReleaseLabel(release: {
  artistName: string | null;
  projectTitle: string | null;
  title: string;
}) {
  if (release.artistName && release.projectTitle) {
    return `${release.artistName} - ${release.projectTitle}`;
  }

  return release.artistName || release.projectTitle || release.title;
}
