import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ReleaseBrief } from "@/components/release-brief";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPublicEditorialCollection } from "@/lib/public-editorial";
import { getPopularityMaxForReleases } from "@/lib/release-metrics";
import { getSiteUrl } from "@/lib/site";
import { formatDetailedUtcDate } from "@/lib/utils";

type CollectionPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getPublicEditorialCollection(slug);

  if (!collection) {
    return {
      title: "Collection | MooSQA",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = `${collection.title} | MooSQA`;
  const description =
    collection.description || `Published MooSQA ${collection.type.toLowerCase().replaceAll("_", " ")} collection.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${getSiteUrl()}/collections/${collection.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${getSiteUrl()}/collections/${collection.slug}`,
    },
  };
}

export default function CollectionPage({ params }: CollectionPageProps) {
  return (
    <main className="editorial-shell flex-1 px-4 pb-10 pt-4 md:px-8">
      <div className="mx-auto max-w-[1760px] bg-[var(--color-paper)] px-2 md:px-4">
        <Suspense fallback={<HeaderFallback />}>
          <SiteHeader />
        </Suspense>
        <Suspense fallback={<CollectionShellFallback />}>
          <CollectionContent params={params} />
        </Suspense>
        <SiteFooter />
      </div>
    </main>
  );
}

async function CollectionContent({ params }: CollectionPageProps) {
  const { slug } = await params;
  const collection = await getPublicEditorialCollection(slug);

  if (!collection) {
    return (
      <section className="border-t border-[var(--color-line)] py-10 md:py-14">
        <p className="section-kicker text-black/43">Editorial</p>
        <h1 className="mt-3 text-5xl leading-none text-[var(--color-ink)] serif-display md:text-7xl">
          Collection unavailable.
        </h1>
        <div className="mt-8 max-w-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5 text-sm leading-7 text-black/64">
          This collection is not published, has no visible public releases, or is no longer available.
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/picks"
              className="inline-flex min-h-11 items-center border border-[var(--color-line)] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
            >
              Back to picks
            </Link>
            <Link
              href="/browse/latest"
              className="inline-flex min-h-11 items-center border border-[var(--color-line)] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
            >
              Browse latest
            </Link>
          </div>
        </div>
      </section>
    );
  }
  const popularityMaxRaw = getPopularityMaxForReleases(collection.entries.map((entry) => entry.release));

  return (
    <section className="border-t border-[var(--color-line)] py-10 md:py-14">
      <div className="mb-10">
        <p className="section-kicker text-black/43">{collection.type.replaceAll("_", " ")}</p>
        <h1 className="mt-3 text-5xl leading-none text-[var(--color-ink)] serif-display md:text-7xl">
          {collection.title}
        </h1>
        {collection.description ? (
          <p className="mt-5 max-w-3xl text-sm leading-7 text-black/64">{collection.description}</p>
        ) : null}
        {collection.publishedAt ? (
          <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-black/50">
            Published {formatDetailedUtcDate(collection.publishedAt)}
          </p>
        ) : null}
        <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-black/50">
          {collection.entries.length} public release{collection.entries.length === 1 ? "" : "s"} in this collection
        </p>
      </div>

      <div className="grid gap-5">
        {collection.entries.map((entry) => (
          <article key={entry.id} className="border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
            <div className="flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.18em] text-black/48">
              <span>#{entry.position}</span>
              {entry.note ? <span>{entry.note}</span> : null}
            </div>
            <div className="mt-4">
              <ReleaseBrief
                release={entry.release}
                className="border-t-0 pt-0"
                fromHref={`/collections/${collection.slug}`}
                popularityMaxRaw={popularityMaxRaw}
              />
            </div>
          </article>
        ))}
      </div>

      <div className="mt-8">
        <Link
          href="/picks"
          className="inline-flex min-h-11 items-center border border-[var(--color-line)] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
        >
          Back to picks
        </Link>
      </div>
    </section>
  );
}

function CollectionShellFallback() {
  return (
    <section className="border-t border-[var(--color-line)] py-10 md:py-14">
      <div className="h-20 animate-pulse bg-[var(--color-panel)]" />
      <div className="mt-8 grid gap-5">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-36 animate-pulse border border-[var(--color-line)] bg-[var(--color-panel)]" />
        ))}
      </div>
    </section>
  );
}

function HeaderFallback() {
  return (
    <div className="border-b border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-4 md:px-6 lg:px-8 lg:py-8">
      <div className="h-16 animate-pulse bg-[var(--color-panel)]" />
    </div>
  );
}
