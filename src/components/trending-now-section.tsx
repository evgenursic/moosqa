import { Flame } from "lucide-react";

import { ReleaseBrief } from "@/components/release-brief";
import type { ReleaseListingItem } from "@/lib/release-sections";

type TrendingNowSectionProps = {
  items: Array<{
    release: ReleaseListingItem | null;
    count: number;
  }>;
};

export function TrendingNowSection({ items }: TrendingNowSectionProps) {
  const visibleItems = items.filter((item) => item.release);
  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <section id="trending-now" className="border-t border-[var(--color-line)] py-10">
      <div className="mb-6 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-accent-strong)]">
          <Flame size={17} strokeWidth={1.9} />
        </span>
        <div>
          <p className="section-kicker text-black/43">Trending now</p>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-black/62">
            Releases rising through opens, listening clicks, shares, and audience reactions.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {visibleItems.map((item, index) => (
          <div key={`${item.release?.id}-${index}`} className="border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
            <div className="mb-4 flex items-center justify-between gap-4">
              <p className="section-kicker text-black/43">#{index + 1}</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent-strong)]">
                {item.count} trend score
              </p>
            </div>
            {item.release ? <ReleaseBrief release={item.release} fromHref="/#trending-now" /> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
