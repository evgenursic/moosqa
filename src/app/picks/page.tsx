import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ReleaseBrief } from "@/components/release-brief";
import { ReleaseCard } from "@/components/release-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPublicEditorialHubData } from "@/lib/public-editorial";
import { getSiteUrl } from "@/lib/site";
import { formatDetailedUtcDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Editors' Picks | MooSQA",
  description: "Published MooSQA editorial picks and curated collections built from the live indie release feed.",
  alternates: {
    canonical: `${getSiteUrl()}/picks`,
  },
  openGraph: {
    title: "Editors' Picks | MooSQA",
    description: "Published MooSQA editorial picks and curated collections built from the live indie release feed.",
    url: `${getSiteUrl()}/picks`,
  },
};

export default function PicksPage() {
  return (
    <main className="editorial-shell flex-1 px-4 pb-10 pt-4 md:px-8">
      <div className="mx-auto max-w-[1760px] bg-[var(--color-paper)] px-2 md:px-4">
        <SiteHeader />
        <Suspense fallback={<EditorialShellFallback />}>
          <PicksContent />
        </Suspense>
        <SiteFooter />
      </div>
    </main>
  );
}

async function PicksContent() {
  const editorial = await getPublicEditorialHubData();

  return (
    <section className="border-t border-[var(--color-line)] py-10 md:py-14">
      <div className="mb-10">
        <p className="section-kicker text-black/43">Editorial</p>
        <h1 className="mt-3 text-5xl leading-none text-[var(--color-ink)] serif-display md:text-7xl">
          Editors&apos; picks.
        </h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-black/64">
          Published collections and featured releases selected from the live MooSQA feed.
        </p>
      </div>

      <section>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="section-kicker text-black/43">Featured now</p>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-black/62">
              Current editorial priority releases from the public feed.
            </p>
          </div>
        </div>

        {editorial.featuredReleases.length > 0 ? (
          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {editorial.featuredReleases.map((release, index) => (
              <ReleaseCard
                key={release.id}
                release={release}
                compact={index > 1}
                priority={index < 2}
                fromHref="/picks"
              />
            ))}
          </div>
        ) : (
          <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-6 text-sm leading-7 text-black/63">
            No public editor picks are published yet.
          </div>
        )}
      </section>

      <section className="mt-12 border-t border-[var(--color-line)] pt-10">
        <div className="mb-6">
          <p className="section-kicker text-black/43">Collections</p>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-black/62">
            Lightweight curation layers that stay tied to the automated feed instead of replacing it.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          {editorial.collections.map((collection) => (
            <article key={collection.id} className="border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
              <div className="flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.18em] text-black/50">
                <span>{collection.type.replaceAll("_", " ")}</span>
                {collection.publishedAt ? <span>{formatDetailedUtcDate(collection.publishedAt)}</span> : null}
              </div>
              <h2 className="mt-3 text-4xl leading-[0.94] text-[var(--color-ink)] serif-display">
                <Link href={`/collections/${collection.slug}`} className="card-title-underline">
                  {collection.title}
                </Link>
              </h2>
              {collection.description ? (
                <p className="mt-3 max-w-2xl text-sm leading-7 text-black/64">{collection.description}</p>
              ) : null}
              <div className="mt-5 grid gap-4">
                {collection.entries.map((release) => (
                  <ReleaseBrief key={release.id} release={release} fromHref={`/collections/${collection.slug}`} />
                ))}
              </div>
              <div className="mt-5">
                <Link
                  href={`/collections/${collection.slug}`}
                  className="inline-flex items-center border border-[var(--color-line)] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
                >
                  Open collection
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function EditorialShellFallback() {
  return (
    <section className="border-t border-[var(--color-line)] py-10 md:py-14">
      <div className="h-20 animate-pulse bg-[var(--color-panel)]" />
      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="h-72 animate-pulse border border-[var(--color-line)] bg-[var(--color-panel)]" />
        ))}
      </div>
    </section>
  );
}
