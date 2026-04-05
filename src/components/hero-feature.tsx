import Link from "next/link";

import { ReleaseType } from "@/generated/prisma/enums";
import { ListeningLinks } from "@/components/listening-links";
import { RatingMeter } from "@/components/rating-meter";
import { ReleaseArtwork } from "@/components/release-artwork";
import {
  formatPrimaryReleaseDateLabel,
  formatRelative,
  formatReleaseTypeLabel,
  getDisplayGenre,
  getDisplaySummary,
} from "@/lib/utils";

type HeroFeatureProps = {
  release: {
    id: string;
    slug: string;
    title: string;
    artistName: string | null;
    projectTitle: string | null;
    releaseType: ReleaseType;
    imageUrl: string | null;
    summary: string | null;
    aiSummary: string | null;
    outletName: string | null;
    labelName: string | null;
    genreName: string | null;
    releaseDate: Date | null;
    publishedAt: Date;
    scoreAverage: number;
    scoreCount: number;
    redditPermalink: string;
    sourceUrl: string;
    youtubeUrl: string | null;
    youtubeMusicUrl: string | null;
    bandcampUrl: string | null;
    officialWebsiteUrl: string | null;
    officialStoreUrl: string | null;
  };
};

export function HeroFeature({ release }: HeroFeatureProps) {
  const displayGenre = getDisplayGenre(release.genreName, release.releaseType);

  return (
    <article className="border-b border-[var(--color-line)] pb-10">
      <ReleaseArtwork
        title={release.title}
        artistName={release.artistName}
        projectTitle={release.projectTitle}
        imageUrl={release.imageUrl}
        genreName={displayGenre}
        imageClassName="aspect-[16/10]"
        className="min-h-[20rem]"
        priority
      />

      <div className="grid gap-8 pt-6 lg:grid-cols-[1.1fr_0.55fr]">
        <div>
          <p className="section-kicker text-black/45">Lead story</p>
          <h1 className="mt-4 max-w-5xl text-6xl leading-[0.92] text-[var(--color-ink)] serif-display md:text-7xl">
            {release.artistName || release.projectTitle || release.title}
          </h1>
          <p className="mt-4 max-w-4xl text-2xl leading-tight text-black/74 serif-display md:text-[2.1rem]">
            {release.artistName && release.projectTitle ? release.projectTitle : release.title}
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.18em] text-black/55">
            {release.labelName ? (
              <span className="border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2">
                {release.labelName}
              </span>
            ) : null}
          </div>
          <p className="mt-5 max-w-4xl text-sm leading-7 text-black/63">
            {getDisplaySummary({
              aiSummary: release.aiSummary,
              summary: release.summary,
              artistName: release.artistName,
              projectTitle: release.projectTitle,
              title: release.title,
              releaseType: release.releaseType,
              genreName: release.genreName,
            })}
          </p>

          <div className="mt-6 flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.18em] text-black/55">
            <span>{displayGenre}</span>
            <span>{formatReleaseTypeLabel(release.releaseType)}</span>
            <span>{release.outletName || "Source pending"}</span>
            <span>{formatPrimaryReleaseDateLabel(release.releaseType, release.releaseDate, release.publishedAt)}</span>
            <span>{formatRelative(release.publishedAt)}</span>
          </div>

          <ListeningLinks release={release} />

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/releases/${release.slug}`}
              className="inline-flex items-center border border-[var(--color-accent-strong)] bg-[var(--color-accent-strong)] px-4 py-3 text-xs uppercase tracking-[0.18em] text-white transition hover:opacity-92"
            >
              Open story
            </Link>
            <a
              href={release.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center border border-[var(--color-line)] px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--color-ink)] transition hover:border-[var(--color-ink)]"
            >
              Original source
            </a>
            <a
              href={release.redditPermalink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center border border-[var(--color-line)] px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--color-ink)] transition hover:border-[var(--color-ink)]"
            >
              Reddit thread
            </a>
          </div>
        </div>

        <div>
          <RatingMeter
            releaseId={release.id}
            initialAverage={release.scoreAverage}
            initialCount={release.scoreCount}
          />
        </div>
      </div>
    </article>
  );
}
