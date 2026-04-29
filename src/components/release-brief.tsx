import { ReleaseType } from "@/generated/prisma/enums";
import { getListeningLinks } from "@/lib/listening-links";
import { ReleaseArtwork } from "@/components/release-artwork";
import { ReleaseLink } from "@/components/release-link";
import { ReleaseMetricBadge } from "@/components/release-metric-badge";
import {
  cn,
  formatContextualReleaseDateLabel,
  formatRedditDateLabel,
  formatReleaseTypeLabel,
  formatScore,
  getDisplayGenre,
} from "@/lib/utils";

type ReleaseBriefProps = {
  release: {
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
    score?: number | null;
    commentCount?: number | null;
    popularityMaxRaw?: number | null;
    bandcampUrl?: string | null;
    bandcampSupporterCount?: number | null;
    bandcampFollowerCount?: number | null;
    officialWebsiteUrl?: string | null;
    officialStoreUrl?: string | null;
    genreName?: string | null;
    releaseDate?: Date | null;
    scoreAverage: number;
    scoreCount: number;
    publishedAt: Date;
  };
  emphasis?: "score" | "time" | "listen";
  className?: string;
  fromHref?: string | null;
  popularityMaxRaw?: number | null;
};

export function ReleaseBrief({
  release,
  emphasis = "time",
  className,
  fromHref = null,
  popularityMaxRaw = null,
}: ReleaseBriefProps) {
  const directLinks = getListeningLinks(release).filter((link) => link.isDirect);
  const displayGenre = getDisplayGenre(release.genreName, release.releaseType);

  return (
    <ReleaseLink
      slug={release.slug}
      fromHref={fromHref}
      className={cn(
        "grid min-w-0 grid-cols-[5.25rem_minmax(0,1fr)] gap-3 border-t border-[var(--color-line)] pt-4 first:border-t-0 first:pt-0 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-4",
        className,
      )}
    >
      <div className="relative">
        <ReleaseArtwork
          releaseId={release.id}
          title={release.title}
          artistName={release.artistName}
          projectTitle={release.projectTitle}
          imageUrl={release.imageUrl}
          thumbnailUrl={release.thumbnailUrl || null}
          sourceUrl={release.sourceUrl}
          youtubeUrl={release.youtubeUrl || null}
          youtubeMusicUrl={release.youtubeMusicUrl || null}
          bandcampUrl={release.bandcampUrl || null}
          officialWebsiteUrl={release.officialWebsiteUrl || null}
          officialStoreUrl={release.officialStoreUrl || null}
          genreName={displayGenre}
          className="h-[5.25rem] sm:h-[6.5rem]"
          imageClassName="h-full"
        />
        <ReleaseMetricBadge
          sourceUrl={release.sourceUrl}
          outletName={release.outletName}
          youtubeViewCount={release.youtubeViewCount}
          redditUpvotes={release.score}
          redditComments={release.commentCount}
          popularityMaxRaw={popularityMaxRaw ?? release.popularityMaxRaw ?? null}
          bandcampSupporterCount={release.bandcampSupporterCount}
          bandcampFollowerCount={release.bandcampFollowerCount}
          fallbackLabel={formatReleaseTypeLabel(release.releaseType)}
          className="absolute right-1.5 top-1.5 z-10 max-w-[calc(100%-0.75rem)]"
          compact
        />
      </div>

      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.18em] text-black/46">
          {displayGenre}
        </p>
        <h3 className="mt-2 break-words text-[1.35rem] leading-[0.95] text-[var(--color-ink)] serif-display sm:text-[1.7rem] sm:leading-[0.92]">
          {release.artistName || release.projectTitle || release.title}
        </h3>
        <p className="mt-1 truncate text-sm leading-6 text-black/60">
          {release.artistName && release.projectTitle ? release.projectTitle : release.title}
        </p>

        <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-black/52">
          {renderEmphasis(emphasis, release, directLinks.length)}
        </p>
      </div>
    </ReleaseLink>
  );
}

function renderEmphasis(
  emphasis: NonNullable<ReleaseBriefProps["emphasis"]>,
  release: ReleaseBriefProps["release"],
  directCount: number,
) {
  if (emphasis === "score") {
    return `${formatScore(release.scoreAverage)} / ${release.scoreCount} ratings`;
  }

  if (emphasis === "listen") {
    return directCount > 0
      ? `${directCount} working link${directCount > 1 ? "s" : ""}`
      : `${release.outletName || "Source"} / search fallback`;
  }

  const sourceDateLabel = formatContextualReleaseDateLabel(
    release.releaseType,
    release.releaseDate,
    release.outletName,
  );
  const redditDateLabel = formatRedditDateLabel(release.publishedAt);
  const meta = [sourceDateLabel, redditDateLabel, release.outletName || "Source pending"].filter(Boolean);
  return meta.join(" / ");
}
