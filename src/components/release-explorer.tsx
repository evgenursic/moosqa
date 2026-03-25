"use client";

import { useDeferredValue, useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";

import { ReleaseType } from "@/generated/prisma/enums";
import { ReleaseCard } from "@/components/release-card";
import { detectPlatform } from "@/lib/listening-links";

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
    bandcampUrl?: string | null;
    labelName?: string | null;
    genreName?: string | null;
    summary?: string | null;
    aiSummary?: string | null;
    publishedAt: string;
    scoreAverage: number;
    scoreCount: number;
  }>;
};

const INITIAL_PAGE_SIZE = 12;
const PAGE_INCREMENT = 8;

export function ReleaseExplorer({ releases }: ReleaseExplorerProps) {
  const searchParams = useSearchParams();
  const queryFromUrl = searchParams.get("q") || "";
  const typeFromUrl = searchParams.get("type") || "";
  const platformFromUrl = searchParams.get("platform") || "";
  const directOnly = searchParams.get("direct") === "1";
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE);
  const deferredQuery = useDeferredValue(queryFromUrl);
  const [isPending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const normalizedQuery = normalizeSearchText(deferredQuery);
  const filteredReleases = releases
    .map((release) => ({
      release,
      score: getSearchScore(release, normalizedQuery),
    }))
    .filter(({ release, score }) => {
      if (normalizedQuery.length > 0 && score <= 0) {
        return false;
      }

      if (typeFromUrl && release.releaseType !== typeFromUrl) {
        return false;
      }

      if (platformFromUrl && getReleasePlatform(release) !== platformFromUrl) {
        return false;
      }

      if (directOnly && !hasDirectListeningLink(release)) {
        return false;
      }

      return true;
    })
    .sort((left, right) => {
      if (normalizedQuery.length > 0 && right.score !== left.score) {
        return right.score - left.score;
      }

      return (
        new Date(right.release.publishedAt).getTime() - new Date(left.release.publishedAt).getTime()
      );
    })
    .map(({ release }) => release);

  useEffect(() => {
    startTransition(() => {
      setVisibleCount(INITIAL_PAGE_SIZE);
    });
  }, [deferredQuery, directOnly, platformFromUrl, typeFromUrl]);

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
          setVisibleCount((current) =>
            Math.min(current + PAGE_INCREMENT, filteredReleases.length),
          );
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

        <div className="w-full max-w-xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 text-sm leading-7 text-black/62">
          Search updates from the header above and keeps loading more results as you scroll.
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.18em] text-black/50">
        <span>{filteredReleases.length} matches</span>
        <span>{visibleReleases.length} visible</span>
        {queryFromUrl ? <span>Query: {queryFromUrl}</span> : null}
        {typeFromUrl ? <span>Type: {typeFromUrl.replace("_", " ")}</span> : null}
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
              }}
              compact={index > 5}
              priority={index < 2}
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

function getSearchScore(release: ReleaseExplorerProps["releases"][number], query: string) {
  if (!query) {
    return 1;
  }

  const tokens = query.split(" ").filter(Boolean);
  const fields = {
    artist: normalizeSearchText(release.artistName || ""),
    title: normalizeSearchText(release.title),
    project: normalizeSearchText(release.projectTitle || ""),
    genre: normalizeSearchText(release.genreName || ""),
    label: normalizeSearchText(release.labelName || ""),
    outlet: normalizeSearchText(release.outletName || ""),
    summary: normalizeSearchText(release.summary || ""),
    aiSummary: normalizeSearchText(release.aiSummary || ""),
    type: normalizeSearchText(release.releaseType.replace("_", " ")),
    source: normalizeSearchText(release.sourceUrl),
  };

  const combined = Object.values(fields).join(" ");
  if (!combined.includes(query) && !tokens.every((token) => combined.includes(token))) {
    return 0;
  }

  let score = 0;

  if (fields.artist.startsWith(query)) score += 80;
  if (fields.project.startsWith(query)) score += 75;
  if (fields.title.startsWith(query)) score += 70;
  if (fields.genre.startsWith(query)) score += 42;
  if (fields.label.startsWith(query)) score += 36;
  if (fields.artist.includes(query)) score += 34;
  if (fields.project.includes(query)) score += 30;
  if (fields.title.includes(query)) score += 28;
  if (fields.aiSummary.includes(query)) score += 18;
  if (fields.summary.includes(query)) score += 16;
  if (fields.outlet.includes(query)) score += 12;
  if (fields.source.includes(query)) score += 8;

  for (const token of tokens) {
    if (fields.artist.includes(token)) score += 10;
    if (fields.project.includes(token)) score += 9;
    if (fields.title.includes(token)) score += 8;
    if (fields.genre.includes(token)) score += 6;
    if (fields.label.includes(token)) score += 5;
    if (fields.aiSummary.includes(token)) score += 4;
    if (fields.summary.includes(token)) score += 3;
    if (fields.outlet.includes(token) || fields.type.includes(token)) score += 2;
  }

  return score;
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s/+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasDirectListeningLink(release: ReleaseExplorerProps["releases"][number]) {
  return Boolean(
    release.youtubeUrl ||
      release.youtubeMusicUrl ||
      release.bandcampUrl ||
      detectPlatform(release.sourceUrl) === "youtube" ||
      detectPlatform(release.sourceUrl) === "youtube-music" ||
      detectPlatform(release.sourceUrl) === "bandcamp",
  );
}

function getReleasePlatform(release: ReleaseExplorerProps["releases"][number]) {
  const directPlatform = detectPlatform(release.sourceUrl);
  if (directPlatform) {
    return directPlatform;
  }

  if (release.youtubeUrl) {
    return "youtube";
  }

  if (release.youtubeMusicUrl) {
    return "youtube-music";
  }

  if (release.bandcampUrl) {
    return "bandcamp";
  }

  const source = release.sourceUrl.toLowerCase();
  if (source.includes("spotify.com")) {
    return "spotify";
  }
  if (source.includes("music.apple.com")) {
    return "apple-music";
  }

  return "";
}
