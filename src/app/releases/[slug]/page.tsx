import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ListeningLinks } from "@/components/listening-links";
import { RatingMeter } from "@/components/rating-meter";
import { BackToHomeButton } from "@/components/back-to-home-button";
import { MobileReleaseNav } from "@/components/mobile-release-nav";
import { ReleaseArtwork } from "@/components/release-artwork";
import { TopEngagedVisual } from "@/components/top-engaged-visual";
import { getSiteUrl } from "@/lib/site";
import { getReleaseBySlug } from "@/lib/sync-releases";
import {
  formatContextualReleaseDateLabel,
  formatPubDate,
  formatRedditDateLabel,
  formatReleaseTypeLabel,
  getDisplayGenre,
  getDisplaySummary,
} from "@/lib/utils";

type ReleasePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({ params }: ReleasePageProps): Promise<Metadata> {
  const { slug } = await params;
  const release = await getReleaseBySlug(slug);

  if (!release) {
    return {
      title: "Release not found | MooSQA",
    };
  }

  const summary = getDisplaySummary({
    aiSummary: release.aiSummary,
    summary: release.summary,
    artistName: release.artistName,
    projectTitle: release.projectTitle,
    title: release.title,
    releaseType: release.releaseType,
    genreName: release.genreName,
  });
  const title = release.artistName && release.projectTitle
    ? `${release.artistName} - ${release.projectTitle} | MooSQA`
    : `${release.title} | MooSQA`;
  const url = new URL(`/releases/${release.slug}`, getSiteUrl()).toString();
  const image = release.imageUrl || release.thumbnailUrl || undefined;

  return {
    title,
    description: summary,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description: summary,
      url,
      siteName: "MooSQA",
      type: "article",
      images: image ? [{ url: image, alt: release.title }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description: summary,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ReleasePage({ params }: ReleasePageProps) {
  const { slug } = await params;
  const release = await getReleaseBySlug(slug);

  if (!release) {
    notFound();
  }

  const displayGenre = getDisplayGenre(release.genreName, release.releaseType);
  const releaseHeading = release.artistName || release.projectTitle || release.title;
  const releaseDateLabel = formatContextualReleaseDateLabel(
    release.releaseType,
    release.releaseDate,
    release.outletName,
  );
  const redditDateLabel = formatRedditDateLabel(release.publishedAt);

  return (
    <main className="min-h-screen px-4 py-6 md:px-8">
      <MobileReleaseNav title={releaseHeading} />
      <div className="mx-auto max-w-[1500px] bg-[var(--color-paper)] px-2 md:px-4">
        <div className="grid gap-10 border-b border-[var(--color-line)] py-6 pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:pt-6">
          <section className="space-y-6">
            <BackToHomeButton className="section-kicker inline-flex cursor-pointer text-black/43 transition hover:text-[var(--color-accent-strong)]" />

            <div>
              <p className="section-kicker text-black/43">{formatReleaseTypeLabel(release.releaseType)}</p>
              <h1 className="mt-4 max-w-5xl text-6xl leading-[0.92] text-[var(--color-ink)] serif-display md:text-7xl">
                {releaseHeading}
              </h1>
              <p className="mt-4 max-w-4xl text-2xl leading-tight text-black/72 serif-display">
                {release.artistName && release.projectTitle ? release.projectTitle : release.title}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.18em] text-black/55">
              {releaseDateLabel ? <span>{releaseDateLabel}</span> : null}
              {redditDateLabel ? <span>{redditDateLabel}</span> : null}
              <span>{release.outletName || "Source pending"}</span>
              <span>{displayGenre}</span>
              {release.labelName ? <span>{release.labelName}</span> : null}
            </div>

            <div className="max-w-4xl border border-[var(--color-line)] bg-[var(--color-panel)] p-6 text-sm leading-7 text-black/66">
              <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-black/45">Summary</p>
              <p>
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
            </div>

            <TopEngagedVisual
              score={release.score}
              commentCount={release.commentCount}
            />

            <ListeningLinks release={release} />

            <div className="flex flex-wrap gap-3">
              <a
                href={release.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center border border-[var(--color-accent-strong)] bg-[var(--color-accent-strong)] px-4 py-3 text-xs uppercase tracking-[0.18em] text-white transition hover:opacity-92"
              >
                Open original source
              </a>
              <a
                href={release.redditPermalink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center border border-[var(--color-line)] px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--color-ink)] transition hover:border-[var(--color-ink)]"
              >
                Open Reddit thread
              </a>
            </div>
          </section>

          <section className="space-y-6">
            <ReleaseArtwork
              releaseId={release.id}
              title={release.title}
              artistName={release.artistName}
              projectTitle={release.projectTitle}
              imageUrl={release.imageUrl || null}
              thumbnailUrl={release.thumbnailUrl || null}
              sourceUrl={release.sourceUrl}
              youtubeUrl={release.youtubeUrl || null}
              youtubeMusicUrl={release.youtubeMusicUrl || null}
              bandcampUrl={release.bandcampUrl || null}
              officialWebsiteUrl={release.officialWebsiteUrl || null}
              officialStoreUrl={release.officialStoreUrl || null}
              genreName={displayGenre}
              imageClassName="aspect-[4/3]"
            />

            <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
              <p className="section-kicker text-black/45">At a glance</p>
              <div className="mt-4 flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.18em] text-black/55">
                <span className="border border-[var(--color-line)] px-3 py-2">{displayGenre}</span>
                {release.labelName ? (
                  <span className="border border-[var(--color-line)] px-3 py-2">{release.labelName}</span>
                ) : null}
                {release.releaseDate ? (
                  <span className="border border-[var(--color-line)] px-3 py-2">
                    Release date {formatPubDate(release.releaseDate)}
                  </span>
                ) : null}
              </div>
            </div>

            <RatingMeter
              releaseId={release.id}
              initialAverage={release.scoreAverage}
              initialCount={release.scoreCount}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
