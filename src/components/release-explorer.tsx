"use client";

import { useDeferredValue, useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";

import { ReleaseType } from "@/generated/prisma/enums";
import { ReleaseCard } from "@/components/release-card";
import { filterAndRankReleaseListings } from "@/lib/release-search";

type ReleaseExplorerProps = {
  releases: Array<{
    id: string;
    slug: string;
    title: string;
    artistName: string | null;
    projectTitle: string | null;
    releaseType: ReleaseType;
    imageUrl: string | null;
    thumbnailUrl?: string | null;
    outletName: string | null;
    sourceUrl: string;
    youtubeUrl?: string | null;
    youtubeMusicUrl?: string | null;
    youtubeViewCount?: number | null;
    youtubePublishedAt?: Date | string | null;
    bandcampUrl?: string | null;
    bandcampSupporterCount?: number | null;
    bandcampFollowerCount?: number | null;
    officialWebsiteUrl?: string | null;
    officialStoreUrl?: string | null;
    labelName?: string | null;
    genreName?: string | null;
    qualityScore: number;
    summary?: string | null;
    aiSummary?: string | null;
    publishedAt: string;
    scoreAverage: number;
    scoreCount: number;
    positiveReactionCount: number;
    negativeReactionCount: number;
    score?: number | null;
    commentCount?: number | null;
  }>;
};

const INITIAL_PAGE_SIZE = 12;
const PAGE_INCREMENT = 8;

export function ReleaseExplorer({ releases }: ReleaseExplorerProps) {
  const searchParams = useSearchParams();
  const queryFromUrl = searchParams.get("q") || "";
  const typeFromUrl = searchParams.get("type") || "";
  const genreFromUrl = searchParams.get("genre") || "";
  const platformFromUrl = searchParams.get("platform") || "";
  const directOnly = searchParams.get("direct") === "1";
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE);
  const deferredQuery = useDeferredValue(queryFromUrl);
  const [isPending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const explorerHref = buildExplorerHref({
    query: queryFromUrl,
    type: typeFromUrl,
    genre: genreFromUrl,
    platform: platformFromUrl,
    directOnly,
  });

  const filteredReleases = filterAndRankReleaseListings(releases, {
    query: deferredQuery,
    type: typeFromUrl,
    genre: genreFromUrl,
    platform: platformFromUrl,
    directOnly,
  });

  useEffect(() => {
    startTransition(() => {
      setVisibleCount(INITIAL_PAGE_SIZE);
    });
  }, [deferredQuery, directOnly, genreFromUrl, platformFromUrl, typeFromUrl]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) {
          return;
        }

        startTransition(() => {
          setVisibleCount((current) => Math.min(current + PAGE_INCREMENT, filteredReleases.length));
        });
      },
      { rootMargin: "900px 0px" },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [filteredReleases.length]);

  const visibleReleases = filteredReleases.slice(0, visibleCount);

  return (
    <section className="border-t border-[var(--color-line)] py-8 md:py-10" id="explore">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="section-kicker text-black/43">Search results</p>
          <h2 className="mt-3 text-4xl leading-none text-[var(--color-ink)] serif-display md:text-5xl">
            Matching releases.
          </h2>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.18em] text-black/50">
        <span>{filteredReleases.length} matches</span>
        <span>{visibleReleases.length} visible</span>
        {queryFromUrl ? <span>Query: {queryFromUrl}</span> : null}
        {typeFromUrl ? <span>Type: {typeFromUrl.replace("_", " ")}</span> : null}
        {genreFromUrl ? <span>Genre: {genreFromUrl}</span> : null}
        {platformFromUrl ? <span>Platform: {platformFromUrl}</span> : null}
        {directOnly ? <span>Working links only</span> : null}
        {isPending ? <span>Loading more</span> : null}
      </div>

      {visibleReleases.length > 0 ? (
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
          {visibleReleases.map((release, index) => (
            <ReleaseCard
              key={release.id}
              release={{
                ...release,
                publishedAt: new Date(release.publishedAt),
                youtubePublishedAt: release.youtubePublishedAt ? new Date(release.youtubePublishedAt) : null,
              }}
              compact={index > 5}
              priority={index < 2}
              fromHref={explorerHref}
            />
          ))}
        </div>
      ) : (
        <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-6 text-sm text-black/62">
          No releases match the current search.
        </div>
      )}

      <div ref={sentinelRef} className="h-6 w-full" />
    </section>
  );
}

function buildExplorerHref(input: {
  query: string;
  type: string;
  genre: string;
  platform: string;
  directOnly: boolean;
}) {
  const params = new URLSearchParams();

  if (input.query) {
    params.set("q", input.query);
  }

  if (input.type) {
    params.set("type", input.type);
  }

  if (input.genre) {
    params.set("genre", input.genre);
  }

  if (input.platform) {
    params.set("platform", input.platform);
  }

  if (input.directOnly) {
    params.set("direct", "1");
  }

  const query = params.toString();
  return query ? `/?${query}#explore` : "/#explore";
}
