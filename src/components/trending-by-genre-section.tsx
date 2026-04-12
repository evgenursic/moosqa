import Link from "next/link";

import { ReleaseBrief } from "@/components/release-brief";
import { ShareFilterLink } from "@/components/share-filter-link";
import type { ReleaseListingItem } from "@/lib/release-sections";

type TrendingByGenreSectionProps = {
  items: Array<{
    genre: string;
    count: number;
    release: ReleaseListingItem | null;
  }>;
};

export function TrendingByGenreSection({ items }: TrendingByGenreSectionProps) {
  const visibleItems = items.filter((item) => item.release);
  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <section id="trending-by-genre" className="border-t border-[var(--color-line)] py-10">
      <div className="mb-6">
        <p className="section-kicker text-black/43">Trending by genre</p>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-black/62">
          Fast shortcuts into the genres currently pulling the strongest audience response, with
          direct archive URLs you can open or share.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 xl:grid-cols-5">
        {visibleItems.map((item) => {
          const href = buildGenreTrendHref(item.genre);
          return (
            <div
              key={item.genre}
              className="border border-[var(--color-line)] bg-[var(--color-panel)] p-4"
            >
              <p className="section-kicker text-black/43">{item.genre}</p>
              <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent-strong)]">
                {item.count} genre trend score
              </p>
              <div className="mt-4">
                {item.release ? (
                  <ReleaseBrief release={item.release} fromHref="/#trending-by-genre" />
                ) : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em]">
                <Link
                  href={href}
                  className="inline-flex items-center border border-[var(--color-line)] px-3 py-2 text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
                >
                  Open trend feed
                </Link>
                <ShareFilterLink href={href} label={`${item.genre} trend feed`} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function buildGenreTrendHref(genre: string) {
  return `/browse/top-engaged?genre=${encodeURIComponent(genre)}`;
}
