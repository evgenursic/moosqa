import type { Metadata } from "next";
import { Suspense } from "react";

import { ReleaseType } from "@/generated/prisma/enums";
import { BackToHomeButton } from "@/components/back-to-home-button";
import { ClientWidgetBoundary } from "@/components/client-widget-boundary";
import { ListeningLinks } from "@/components/listening-links";
import { MobileReleaseNav } from "@/components/mobile-release-nav";
import { RatingMeter } from "@/components/rating-meter";
import { ReleaseArtwork } from "@/components/release-artwork";
import { ReleasePublicCounters } from "@/components/release-public-counters";
import { ReleaseUserActions } from "@/components/release-user-actions";
import { formatExternalSourceTypeLabel, getVisibleExternalSources } from "@/lib/external-sources";
import { sanitizeInternalHref } from "@/lib/navigation";
import { normalizePublicHttpUrl } from "@/lib/safe-url";
import { getSiteUrl } from "@/lib/site";
import { getReleaseBySlug } from "@/lib/sync-releases";
import {
  formatContextualReleaseDateLabel,
  formatCompactUtcDate,
  formatRedditDateLabel,
  formatReleaseTypeLabel,
  getDisplayGenre,
  getDisplaySummary,
} from "@/lib/utils";

type ReleasePageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    from?: string | string[];
  }>;
};

export const unstable_instant = false;

export async function generateMetadata({ params }: ReleasePageProps): Promise<Metadata> {
  try {
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
    const socialImage = new URL(`/releases/${release.slug}/opengraph-image`, getSiteUrl()).toString();
    const image =
      normalizePublicHttpUrl(release.imageUrl) ||
      normalizePublicHttpUrl(release.thumbnailUrl) ||
      socialImage;
    const socialDescription = [
      getDisplayGenre(release.genreName, release.releaseType),
      summary,
    ].filter(Boolean).join(". ");

    return {
      title,
      description: socialDescription,
      alternates: {
        canonical: url,
      },
      openGraph: {
        title,
        description: socialDescription,
        url,
        siteName: "MooSQA",
        type: "article",
        images: image ? [{ url: image, alt: release.title }] : undefined,
      },
      twitter: {
        card: image ? "summary_large_image" : "summary",
        title,
        description: socialDescription,
        images: image ? [image] : undefined,
      },
    };
  } catch (error) {
    console.error("Release metadata generation failed.", error);
    return {
      title: "Release | MooSQA",
      description: "A MooSQA release page.",
    };
  }
}

export default async function ReleasePage({ params, searchParams }: ReleasePageProps) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const fallbackHref = sanitizeInternalHref(
    Array.isArray(resolvedSearchParams?.from)
      ? resolvedSearchParams?.from[0]
      : resolvedSearchParams?.from || null,
  );
  let release: Awaited<ReturnType<typeof getReleaseBySlug>> | null = null;

  try {
    release = await getReleaseBySlug(slug);
  } catch (error) {
    console.error(`Release page failed to load for slug ${slug}.`, error);
  }

  if (!release) {
    return <UnavailableReleasePage message="This release page is temporarily unavailable. Reload in a moment." />;
  }

  try {
    return renderReleasePage(release, fallbackHref);
  } catch (error) {
    console.error(`Release page render failed for slug ${slug}.`, error);
    return <UnavailableReleasePage message="This release page is temporarily unavailable. Reload in a moment." />;
  }
}

function renderReleasePage(
  release: NonNullable<Awaited<ReturnType<typeof getReleaseBySlug>>>,
  fallbackHref: string | null,
) {
  const releaseDateValue = release.releaseDate ? new Date(release.releaseDate) : null;
  const publishedAtValue = new Date(release.publishedAt);
  const displayGenre = getDisplayGenre(release.genreName, release.releaseType);
  const releaseHeading = release.artistName || release.projectTitle || release.title;
  const releaseDateLabel = formatContextualReleaseDateLabel(
    release.releaseType,
    releaseDateValue,
    release.outletName,
  );
  const redditDateLabel = formatRedditDateLabel(publishedAtValue);
  const releaseUrl = new URL(`/releases/${release.slug}`, getSiteUrl()).toString();
  const image =
    normalizePublicHttpUrl(release.imageUrl) ||
    normalizePublicHttpUrl(release.thumbnailUrl) ||
    undefined;
  const originalSourceUrl = normalizePublicHttpUrl(release.sourceUrl);
  const redditThreadUrl = normalizePublicHttpUrl(release.redditPermalink);
  const schemaType =
    release.releaseType === ReleaseType.ALBUM || release.releaseType === ReleaseType.EP
      ? "MusicAlbum"
      : "MusicRecording";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name: release.projectTitle || release.title,
    url: releaseUrl,
    description: getDisplaySummary({
      aiSummary: release.aiSummary,
      summary: release.summary,
      artistName: release.artistName,
      projectTitle: release.projectTitle,
      title: release.title,
      releaseType: release.releaseType,
      genreName: release.genreName,
    }),
    byArtist: release.artistName
      ? {
          "@type": "MusicGroup",
          name: release.artistName,
        }
      : undefined,
    genre: displayGenre,
    datePublished: releaseDateValue?.toISOString() || publishedAtValue.toISOString(),
    image,
    isPartOf: {
      "@type": "WebSite",
      name: "MooSQA",
      url: getSiteUrl(),
    },
    publisher: release.outletName
      ? {
          "@type": "Organization",
          name: release.outletName,
        }
      : undefined,
    offers: [release.bandcampUrl, release.officialStoreUrl, release.officialWebsiteUrl]
      .map(normalizePublicHttpUrl)
      .filter((url): url is string => Boolean(url))
      .map((url) => ({
        "@type": "Offer",
        url,
      })),
    sameAs: [release.sourceUrl, release.redditPermalink, release.youtubeUrl, release.youtubeMusicUrl]
      .map(normalizePublicHttpUrl)
      .filter((url): url is string => Boolean(url)),
  };

  return (
    <main className="min-h-screen px-4 py-6 md:px-8">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ClientWidgetBoundary widgetName="mobile-release-nav">
        <MobileReleaseNav title={releaseHeading} fallbackHref={fallbackHref} />
      </ClientWidgetBoundary>
      <div className="mx-auto max-w-[1500px] bg-[var(--color-paper)] px-2 md:px-4">
        <div className="grid gap-10 border-b border-[var(--color-line)] py-6 pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:pt-6">
          <section className="space-y-6">
            <ClientWidgetBoundary widgetName="back-to-home">
              <BackToHomeButton
                fallbackHref={fallbackHref}
                className="section-kicker inline-flex cursor-pointer text-black/43 transition hover:text-[var(--color-accent-strong)]"
              />
            </ClientWidgetBoundary>

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

            {renderReleasePublicCounters(release)}

            <ClientWidgetBoundary
              widgetName="listening-links"
              fallback={<div className="section-kicker text-black/45">Listening links are temporarily unavailable.</div>}
            >
              <ListeningLinks
                release={release}
                releaseId={release.id}
                sourcePath={`/releases/${release.slug}`}
              />
            </ClientWidgetBoundary>

            {renderExternalSources(release)}

            <div className="flex flex-wrap gap-3">
              {originalSourceUrl ? (
                <a
                  href={originalSourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center border border-[var(--color-accent-strong)] bg-[var(--color-accent-strong)] px-4 py-3 text-xs uppercase tracking-[0.18em] text-white transition hover:opacity-92"
                >
                  Open original source
                </a>
              ) : null}
              {redditThreadUrl ? (
                <a
                  href={redditThreadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center border border-[var(--color-line)] px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--color-ink)] transition hover:border-[var(--color-ink)]"
                >
                  Open Reddit thread
                </a>
              ) : null}
            </div>
          </section>

          <section className="space-y-6">
            <ClientWidgetBoundary widgetName="release-artwork">
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
            </ClientWidgetBoundary>

            <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
              <p className="section-kicker text-black/45">At a glance</p>
              <div className="mt-4 flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.18em] text-black/55">
                <span className="border border-[var(--color-line)] px-3 py-2">{displayGenre}</span>
                {release.labelName ? (
                  <span className="border border-[var(--color-line)] px-3 py-2">{release.labelName}</span>
                ) : null}
                {releaseDateLabel ? (
                  <span className="border border-[var(--color-line)] px-3 py-2">{releaseDateLabel}</span>
                ) : null}
                {redditDateLabel ? (
                  <span className="border border-[var(--color-line)] px-3 py-2">{redditDateLabel}</span>
                ) : null}
              </div>
            </div>

            <Suspense
              fallback={
                <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
                  <p className="section-kicker text-black/45">Personal radar</p>
                  <div className="mt-4 h-11 animate-pulse bg-[var(--color-paper)]" />
                </div>
              }
            >
              <ReleaseUserActions
                releaseId={release.id}
                slug={release.slug}
                artistName={release.artistName}
                labelName={release.labelName}
              />
            </Suspense>

            <ClientWidgetBoundary
              widgetName="rating-meter"
              fallback={<div className="section-kicker text-black/45">Ratings are temporarily unavailable.</div>}
            >
              <RatingMeter
                releaseId={release.id}
                initialAverage={release.scoreAverage}
                initialCount={release.scoreCount}
              />
            </ClientWidgetBoundary>
          </section>
        </div>
      </div>
    </main>
  );
}

function renderReleasePublicCounters(
  release: NonNullable<Awaited<ReturnType<typeof getReleaseBySlug>>>,
) {
  try {
    return (
      <ReleasePublicCounters
        youtubeViewCount={release.youtubeViewCount}
        youtubePublishedAt={release.youtubePublishedAt}
        redditUpvotes={release.score}
        redditComments={release.commentCount}
        bandcampSupporterCount={release.bandcampSupporterCount}
        bandcampFollowerCount={release.bandcampFollowerCount}
        openCount={release.openCount}
        listenClickCount={release.listenClickCount}
        shareCount={release.shareCount}
        positiveReactionCount={release.positiveReactionCount}
        negativeReactionCount={release.negativeReactionCount}
      />
    );
  } catch (error) {
    console.error(`Release public counters failed for slug ${release.slug}.`, error);
    return (
      <div className="section-kicker text-black/45">
        Audience signals are temporarily unavailable.
      </div>
    );
  }
}

function renderExternalSources(
  release: NonNullable<Awaited<ReturnType<typeof getReleaseBySlug>>>,
) {
  const sources = getVisibleExternalSources(release.externalSources);

  if (sources.length === 0) {
    return null;
  }

  return (
    <section className="border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
      <p className="section-kicker text-black/45">Reviews & sources</p>
      <div className="mt-4 grid gap-3">
        {sources.map((source) => {
          const published = formatCompactUtcDate(source.publishedAt);

          return (
            <a
              key={source.id}
              href={source.sourceUrl || "#"}
              target="_blank"
              rel="noreferrer"
              className="block border border-[var(--color-line)] bg-[var(--color-paper)] p-4 transition hover:border-[var(--color-accent-strong)]"
            >
              <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em] text-black/48">
                <span>{formatExternalSourceTypeLabel(source.sourceType)}</span>
                <span>{source.sourceName}</span>
                {published ? <span>{published}</span> : null}
              </div>
              <p className="mt-2 text-xl leading-tight text-[var(--color-ink)] serif-display">
                {source.title}
              </p>
              {source.summary ? (
                <p className="mt-2 text-sm leading-6 text-black/62">{source.summary}</p>
              ) : null}
            </a>
          );
        })}
      </div>
    </section>
  );
}

function UnavailableReleasePage({ message }: { message: string }) {
  return (
    <main className="min-h-screen px-4 py-6 md:px-8">
      <div className="mx-auto max-w-[1500px] bg-[var(--color-paper)] px-2 md:px-4">
        <div className="border-b border-[var(--color-line)] py-10">
          <BackToHomeButton className="section-kicker inline-flex cursor-pointer text-black/43 transition hover:text-[var(--color-accent-strong)]" />
          <div className="mt-6 border border-[var(--color-line)] bg-[var(--color-panel)] p-6 text-sm leading-7 text-black/63">
            {message}
          </div>
        </div>
      </div>
    </main>
  );
}
