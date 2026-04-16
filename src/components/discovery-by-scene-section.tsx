import Link from "next/link";

import { ReleaseBrief } from "@/components/release-brief";
import { ShareFilterLink } from "@/components/share-filter-link";
import { buildSceneArchiveHref } from "@/lib/archive-links";
import type { ReleaseListingItem } from "@/lib/release-sections";

type DiscoveryBySceneSectionProps = {
  items: Array<{
    slug: string;
    title: string;
    description: string;
    leadGenre: string;
    count: number;
    release: ReleaseListingItem | null;
  }>;
};

export function DiscoveryBySceneSection({ items }: DiscoveryBySceneSectionProps) {
  const visibleItems = items.filter((item) => item.release);
  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <section id="discovery-by-scene" className="border-t border-[var(--color-line)] py-10">
      <div className="mb-6">
        <p className="section-kicker text-black/43">Discovery by mood / scene</p>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-black/62">
          A lighter editorial layer above raw genres, built to help listeners jump into the right
          mood faster.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {visibleItems.map((item) => {
          const href = buildSceneArchiveHref(item.slug);
          return (
            <div key={item.slug} className="border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
              <p className="section-kicker text-black/43">{item.title}</p>
              <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent-strong)]">
                {item.count} scene score / lead genre {item.leadGenre}
              </p>
              <p className="mt-3 text-sm leading-7 text-black/62">{item.description}</p>
              <div className="mt-4">
                {item.release ? <ReleaseBrief release={item.release} fromHref="/#discovery-by-scene" /> : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em]">
                <Link
                  href={href}
                  prefetch={false}
                  className="inline-flex items-center border border-[var(--color-line)] px-3 py-2 text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
                >
                  Open scene feed
                </Link>
                <ShareFilterLink href={href} label={`${item.title} scene feed`} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
