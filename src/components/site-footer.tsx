import Link from "next/link";

const footerColumns = [
  {
    title: "Radar",
    links: [
      { href: "#latest", label: "Latest posts" },
      { href: "#top-rated", label: "Top rated" },
      { href: "#top-engaged", label: "Top engaged" },
    ],
  },
  {
    title: "Releases",
    links: [
      { href: "#albums", label: "Albums" },
      { href: "#eps", label: "EPs" },
      { href: "#performances", label: "Live sessions" },
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

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-[var(--color-line)] bg-[#17181d] text-white">
      <div className="mx-auto max-w-[1760px] px-6 py-10 md:px-8 lg:px-10 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div>
            <Link href="/" className="inline-block">
              <p className="text-5xl leading-none text-white serif-display md:text-6xl">MooSQA</p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.42em] text-white/58">
                Music Radar
              </p>
            </Link>

            <p className="mt-6 max-w-xl text-sm leading-7 text-white/70">
              Fast indie release discovery built around the latest posts from r/indieheads,
              cleaned into a readable editorial beta for listeners who want new music quickly.
            </p>
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
                      <a key={link.label} href={link.href}>
                        {link.label}
                      </a>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 border-t border-white/12 pt-5 text-[11px] uppercase tracking-[0.16em] text-white/46 md:flex md:items-center md:justify-between">
          <p>© {year} MooSQA beta</p>
          <p className="mt-3 md:mt-0">Editorial discovery feed for new singles, albums, EPs, and live sessions.</p>
        </div>
      </div>
    </footer>
  );
}
