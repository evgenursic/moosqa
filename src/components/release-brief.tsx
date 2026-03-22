import Link from "next/link";

import { ReleaseType } from "@/generated/prisma/enums";
import { getListeningLinks } from "@/lib/listening-links";
import { ReleaseArtwork } from "@/components/release-artwork";
import { cn, formatPubDate, formatScore, getDisplayGenre } from "@/lib/utils";

type ReleaseBriefProps = {
  release: {
    id: string;
    slug: string;
    title: string;
    artistName: string | null;
    projectTitle: string | null;
    releaseType: ReleaseType;
    imageUrl: string | null;
    outletName: string | null;
    sourceUrl: string;
    youtubeUrl?: string | null;
    youtubeMusicUrl?: string | null;
    bandcampUrl?: string | null;
    genreName?: string | null;
    scoreAverage: number;
    scoreCount: number;
    publishedAt: Date;
  };
  emphasis?: "score" | "time" | "listen";
  className?: string;
};

export function ReleaseBrief({
  release,
  emphasis = "time",
  className,
}: ReleaseBriefProps) {
  const directLinks = getListeningLinks(release).filter((link) => link.isDirect);
  const displayGenre = getDisplayGenre(release.genreName, release.releaseType);

  return (
    <Link
      href={`/releases/${release.slug}`}
      className={cn(
        "grid grid-cols-[6.5rem_1fr] gap-4 border-t border-[var(--color-line)] pt-4 first:border-t-0 first:pt-0",
        className,
      )}
    >
      <ReleaseArtwork
        title={release.title}
        artistName={release.artistName}
        projectTitle={release.projectTitle}
        imageUrl={release.imageUrl}
        genreName={displayGenre}
        className="h-[6.5rem]"
        imageClassName="h-full"
        badgeClassName="hidden"
      />

      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.18em] text-black/46">
          {displayGenre}
        </p>
        <h3 className="mt-2 text-[1.7rem] leading-[0.92] text-[var(--color-ink)] serif-display">
          {release.artistName || release.projectTitle || release.title}
        </h3>
        <p className="mt-1 truncate text-sm leading-6 text-black/60">
          {release.artistName && release.projectTitle ? release.projectTitle : release.title}
        </p>

        <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-black/52">
          {renderEmphasis(emphasis, release, directLinks.length)}
        </p>
      </div>
    </Link>
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

  return `${formatPubDate(release.publishedAt)} / ${release.outletName || "Source pending"}`;
}
