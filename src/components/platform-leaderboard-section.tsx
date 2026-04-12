import Link from "next/link";
import { Headphones } from "lucide-react";

import { ReleaseBrief } from "@/components/release-brief";
import { buildPlatformArchiveHref, type PlatformArchiveSlug } from "@/lib/archive-links";
import type { ReleaseListingItem } from "@/lib/release-sections";

type PlatformLeaderboardSectionProps = {
  items: Array<{
    platform: string;
    entries: Array<{
      count: number;
      release: ReleaseListingItem | null;
    }>;
  }>;
};

export function PlatformLeaderboardSection({ items }: PlatformLeaderboardSectionProps) {
  const visibleItems = items.filter((item) => item.entries.some((entry) => entry.release));
  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <section id="platform-leaderboard" className="border-t border-[var(--color-line)] py-10">
      <div className="mb-6 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-accent-strong)]">
          <Headphones size={17} strokeWidth={1.9} />
        </span>
        <div>
          <p className="section-kicker text-black/43">Platform leaders</p>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-black/62">
            The releases listeners click most often on each listening platform this week.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {visibleItems.map((item) => (
          <div key={item.platform} className="border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="section-kicker text-black/43">{item.platform}</p>
              <div className="flex items-center gap-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent-strong)]">
                  This week
                </p>
                {getPlatformArchiveSlug(item.platform) ? (
                  <Link
                    href={buildPlatformArchiveHref(getPlatformArchiveSlug(item.platform)!)}
                    prefetch={false}
                    className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink)] transition hover:text-[var(--color-accent-strong)]"
                  >
                    Open full board
                  </Link>
                ) : null}
              </div>
            </div>
            <div className="mt-4 grid gap-4">
              {item.entries.map((entry, index) => {
                if (!entry.release) {
                  return null;
                }

                return (
                  <div key={`${item.platform}-${entry.release.id}-${index}`}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="section-kicker text-black/43">#{index + 1}</p>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent-strong)]">
                        {entry.count} clicks
                      </p>
                    </div>
                    <ReleaseBrief
                      release={entry.release}
                      emphasis="listen"
                      fromHref="/#platform-leaderboard"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function getPlatformArchiveSlug(platform: string): PlatformArchiveSlug | null {
  if (platform === "Bandcamp") {
    return "bandcamp";
  }
  if (platform === "YouTube Music") {
    return "youtube-music";
  }
  if (platform === "YouTube") {
    return "youtube";
  }

  return null;
}
