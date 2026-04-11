import Link from "next/link";

import { ReleaseType } from "@/generated/prisma/enums";
import { ListeningLinks } from "@/components/listening-links";
import { ReleaseArtwork } from "@/components/release-artwork";
import { TopEngagedVisual } from "@/components/top-engaged-visual";
import { TopRatedVisual } from "@/components/top-rated-visual";
import {
  formatContextualReleaseDateLabel,
  formatRedditDateLabel,
  formatReleaseTypeLabel,
  formatScore,
  getDisplayGenre,
  getDisplaySummary,
} from "@/lib/utils";

type ReleaseCardProps = {
  release: {
    id: string;
    slug: string;
    title: string;
    artistName: string | null;
    projectTitle: string | null;
    releaseType: ReleaseType;
    imageUrl: string | null;
    thumbnailUrl?: string | null;
    summary?: string | null;
    outletName: string | null;
    sourceUrl: string;
    youtubeUrl?: string | null;
    youtubeMusicUrl?: string | null;
    bandcampUrl?: string | null;
    officialWebsiteUrl?: string | null;
    officialStoreUrl?: string | null;
    labelName?: string | null;
    genreName?: string | null;
    aiSummary?: string | null;
    releaseDate?: Date | null;
    publishedAt: Date;
    scoreAverage: number;
    scoreCount: number;
    score?: number | null;
    commentCount?: number | null;
    upvoteRatio?: number | null;
    awardCount?: number | null;
    crosspostCount?: number | null;
  };
  compact?: boolean;
  priority?: boolean;
  context?: "default" | "top-rated" | "top-engaged";
};

export function ReleaseCard({
  release,
  compact = false,
  priority = false,
  context = "default",
}: ReleaseCardProps) {
  const displayGenre = getDisplayGenre(release.genreName, release.releaseType);
  const metaItems = getMetaItems(release, context);
  const showEngagementVisual = hasEngagementData(release);

  return (
    <article className="group min-w-0 border-t border-[var(--color-line)] pt-6">
      <Link href={`/releases/${release.slug}`} className="block min-w-0 cursor-pointer">
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
          priority={priority}
        />
      </Link>

      <div className="pt-4">
        <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-black/55">
          <span className="border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2">
            {displayGenre}
          </span>
          {release.labelName ? (
            <span className="border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2">
              {release.labelName}
            </span>
          ) : null}
        </div>
        <p className="section-kicker text-black/43">
          {formatReleaseTypeLabel(release.releaseType)}
        </p>
        <Link href={`/releases/${release.slug}`} className="block cursor-pointer">
          <h3
            className={
              compact
                ? "mt-3 break-words text-[2rem] leading-[0.94] text-[var(--color-ink)] serif-display md:text-[2.15rem]"
                : "mt-3 break-words text-[2.35rem] leading-[0.94] text-[var(--color-ink)] serif-display md:text-[3rem]"
            }
          >
            <span className="card-title-underline">
              {release.artistName || release.projectTitle || release.title}
            </span>
          </h3>
          <p className="mt-3 break-words text-lg leading-7 text-black/68 serif-display">
            {release.artistName && release.projectTitle ? release.projectTitle : release.title}
          </p>
        </Link>

        <div className="mt-4 flex flex-wrap gap-3 break-words text-[11px] uppercase tracking-[0.18em] text-black/55">
          {metaItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>

        {context === "top-rated" ? (
          <TopRatedVisual average={release.scoreAverage} count={release.scoreCount} />
        ) : null}

        {showEngagementVisual ? (
          <TopEngagedVisual
            score={release.score}
            commentCount={release.commentCount}
            compact
          />
        ) : null}

        <p className="mt-4 text-sm leading-6 text-black/66">
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

        <ListeningLinks release={release} compact />

        <div className="mt-4">
          <Link
            href={`/releases/${release.slug}`}
            className="inline-flex items-center border border-[var(--color-line)] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink)] transition hover:border-[var(--color-ink)]"
          >
            Open and rate
          </Link>
        </div>
      </div>
    </article>
  );
}

function getMetaItems(
  release: ReleaseCardProps["release"],
  context: NonNullable<ReleaseCardProps["context"]>,
) {
  const items = [
    formatContextualReleaseDateLabel(
      release.releaseType,
      release.releaseDate || null,
      release.outletName || null,
    ),
    formatRedditDateLabel(release.publishedAt),
    release.outletName || "Source pending",
  ].filter((item): item is string => Boolean(item));

  if (context === "top-rated") {
    return items;
  }

  if (context === "top-engaged") {
    if ((release.scoreCount ?? 0) > 0) {
      items.push(`MooSQA ${formatScore(release.scoreAverage || 0)} / ${release.scoreCount} users`);
    }

    return items;
  }

  return items;
}

function hasEngagementData(release: ReleaseCardProps["release"]) {
  return (
    (release.score ?? 0) > 0 ||
    (release.commentCount ?? 0) > 0
  );
}
