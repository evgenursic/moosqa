import Link from "next/link";
import { Disc3, Radio, Rows3 } from "lucide-react";

import { ReleaseBrief } from "@/components/release-brief";
import type { ReleaseListingItem, ReleaseSectionKey } from "@/lib/release-sections";

type HomepageFormatRadarProps = {
  albums: ReleaseListingItem[];
  eps: ReleaseListingItem[];
  live: ReleaseListingItem[];
};

type FormatLane = {
  key: ReleaseSectionKey;
  title: string;
  href: string;
  icon: typeof Disc3;
  releases: ReleaseListingItem[];
};

export function HomepageFormatRadar({ albums, eps, live }: HomepageFormatRadarProps) {
  const lanes = ([
    {
      key: "albums",
      title: "Albums",
      href: "/browse/albums",
      icon: Disc3,
      releases: albums.slice(0, 2),
    },
    {
      key: "eps",
      title: "EPs",
      href: "/browse/eps",
      icon: Rows3,
      releases: eps.slice(0, 2),
    },
    {
      key: "live",
      title: "Live sessions",
      href: "/browse/live",
      icon: Radio,
      releases: live.slice(0, 2),
    },
  ] satisfies FormatLane[]).filter((lane) => lane.releases.length > 0);

  if (lanes.length === 0) {
    return null;
  }

  return (
    <section id="format-radar" className="border-t border-[var(--color-line)] py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-kicker text-black/43">Format radar</p>
          <h2 className="mt-3 text-5xl leading-none text-[var(--color-ink)] serif-display">
            Albums, EPs, sessions.
          </h2>
        </div>
        <Link
          href="/browse/albums"
          className="inline-flex items-center border border-[var(--color-line)] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
        >
          Browse formats
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {lanes.map((lane) => {
          const Icon = lane.icon;

          return (
            <div key={lane.key} className="border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center border border-[var(--color-line)] bg-[var(--color-paper)] text-[var(--color-accent-strong)]">
                    <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
                  </span>
                  <p className="section-kicker text-black/43">{lane.title}</p>
                </div>
                <Link
                  href={lane.href}
                  className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent-strong)] transition hover:text-[var(--color-ink)]"
                >
                  Archive
                </Link>
              </div>

              <div className="grid gap-4">
                {lane.releases.map((release) => (
                  <ReleaseBrief
                    key={release.id}
                    release={release}
                    emphasis={lane.key === "live" ? "listen" : "time"}
                    fromHref="/#format-radar"
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
