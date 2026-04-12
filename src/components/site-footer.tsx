import Link from "next/link";

import { getPublicHealthSummary } from "@/lib/ops-dashboard";
import { formatPubDate } from "@/lib/utils";

const footerColumns: Array<{
  title: string;
  links: Array<{
    href: string;
    label: string;
    external?: boolean;
  }>;
}> = [
  {
    title: "Source",
    links: [
      { href: "https://www.reddit.com/r/indieheads/", label: "r/indieheads", external: true },
      { href: "/sitemap.xml", label: "Sitemap" },
    ],
  },
  {
    title: "About",
    links: [
      { href: "/#latest", label: "Latest feed" },
      { href: "/#platform-leaderboard", label: "Platform leaders" },
      { href: "/#home-discovery", label: "Discovery signals" },
    ],
  },
];

const COPYRIGHT_YEAR = 2026;

export async function SiteFooter() {
  let healthSummary: Awaited<ReturnType<typeof getPublicHealthSummary>> | null = null;

  try {
    healthSummary = await getPublicHealthSummary();
  } catch (error) {
    console.error("Footer health summary failed to load.", error);
  }

  return (
    <footer className="mt-16 border-t border-[var(--color-line)] bg-[#17181d] text-white">
      <div className="mx-auto max-w-[1760px] px-6 py-10 md:px-8 lg:px-10 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1fr)]">
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
          </div>

          <div className="grid gap-8 sm:grid-cols-2">
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

          <div className="border border-white/12 bg-white/[0.03] p-4">
            <p className="section-kicker text-white/48">Production health</p>
            <div className="mt-4 grid gap-3 text-sm leading-7 text-white/76">
              <FooterHealthRow
                label="Feed sync"
                value={healthSummary?.sync.label || "Pending"}
                secondary={healthSummary?.sync.lastSuccessAt ? formatPubDate(healthSummary.sync.lastSuccessAt) : null}
              />
              <FooterHealthRow
                label="Open alerts"
                value={String(healthSummary?.openAlertCount ?? 0)}
              />
              <FooterHealthRow
                label="Last alert delivery"
                value={
                  healthSummary?.lastAlertDelivery?.createdAt
                    ? formatPubDate(healthSummary.lastAlertDelivery.createdAt)
                    : "No deliveries yet"
                }
                secondary={
                  healthSummary?.lastAlertDelivery?.channel
                    ? `${healthSummary.lastAlertDelivery.channel} / ${
                        healthSummary.lastAlertDelivery.success ? "delivered" : "failed"
                      }`
                    : null
                }
              />
            </div>
          </div>
        </div>

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

function FooterHealthRow({
  label,
  value,
  secondary = null,
}: {
  label: string;
  value: string;
  secondary?: string | null;
}) {
  return (
    <div className="border-t border-white/10 pt-3 first:border-t-0 first:pt-0">
      <p className="section-kicker text-white/48">{label}</p>
      <p className="mt-2 text-sm uppercase tracking-[0.15em] text-white/86">{value}</p>
      {secondary ? <p className="mt-1 text-xs leading-6 text-white/46">{secondary}</p> : null}
    </div>
  );
}
