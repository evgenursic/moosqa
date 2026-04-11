/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useState } from "react";

import { getArtworkCandidateUrls } from "@/lib/artwork-fallback";
import { cn } from "@/lib/utils";

type ReleaseArtworkProps = {
  releaseId?: string | null;
  title: string;
  artistName: string | null;
  projectTitle: string | null;
  imageUrl: string | null;
  thumbnailUrl?: string | null;
  sourceUrl?: string | null;
  youtubeUrl?: string | null;
  youtubeMusicUrl?: string | null;
  bandcampUrl?: string | null;
  officialWebsiteUrl?: string | null;
  officialStoreUrl?: string | null;
  genreName?: string | null;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
};

export function ReleaseArtwork({
  releaseId,
  title,
  imageUrl,
  thumbnailUrl,
  sourceUrl,
  youtubeUrl,
  youtubeMusicUrl,
  bandcampUrl,
  officialWebsiteUrl,
  officialStoreUrl,
  genreName,
  className,
  imageClassName,
  priority = false,
}: ReleaseArtworkProps) {
  const accent = getArtworkAccent(genreName);
  const artworkCandidates = useMemo(
    () =>
      getArtworkCandidateUrls({
        releaseId,
        imageUrl,
        thumbnailUrl,
        sourceUrl,
        youtubeUrl,
        youtubeMusicUrl,
        bandcampUrl,
        officialWebsiteUrl,
        officialStoreUrl,
      }),
    [
      bandcampUrl,
      imageUrl,
      officialStoreUrl,
      officialWebsiteUrl,
      releaseId,
      sourceUrl,
      thumbnailUrl,
      youtubeMusicUrl,
      youtubeUrl,
    ],
  );
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const activeImageUrl = artworkCandidates.find((url) => !failedUrls.includes(url)) || null;

  function handleImageError() {
    if (!activeImageUrl) {
      return;
    }

    setFailedUrls((current) => (current.includes(activeImageUrl) ? current : [...current, activeImageUrl]));
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden border border-[var(--color-line)] bg-[var(--color-panel)] transition duration-500 ease-out group-hover:border-[var(--color-accent-strong)] group-hover:shadow-[0_24px_54px_rgba(82,110,170,0.18)]",
        className,
      )}
    >
      {activeImageUrl ? (
        <img
          src={activeImageUrl}
          alt={title}
          onError={handleImageError}
          className={cn(
            "h-full w-full object-cover transition duration-700 ease-out will-change-transform group-hover:scale-[1.035] group-hover:brightness-[1.03]",
            imageClassName,
          )}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "low"}
        />
      ) : (
        <div
          className={cn(
            "relative h-full min-h-[18rem] transition duration-700 ease-out will-change-transform group-hover:scale-[1.035]",
            accent,
            imageClassName,
          )}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(255,255,255,0.34),transparent_22%),radial-gradient(circle_at_78%_26%,rgba(255,255,255,0.22),transparent_20%),linear-gradient(140deg,rgba(255,255,255,0.12),transparent_42%,rgba(18,28,48,0.16))]" />
        </div>
      )}
    </div>
  );
}

function getArtworkAccent(genreName: string | null | undefined) {
  const genre = (genreName || "").toLowerCase();

  if (genre.includes("dream") || genre.includes("shoegaze")) {
    return "bg-[linear-gradient(140deg,#617198,#8ba3c3,#ced7ea)]";
  }

  if (genre.includes("punk") || genre.includes("hardcore")) {
    return "bg-[linear-gradient(140deg,#4f6284,#6d84ac,#a8b8d6)]";
  }

  if (genre.includes("electronic") || genre.includes("synth")) {
    return "bg-[linear-gradient(140deg,#4f7092,#7297ba,#bfd1ea)]";
  }

  if (genre.includes("folk") || genre.includes("country")) {
    return "bg-[linear-gradient(140deg,#727aa4,#97a6c9,#d9dff0)]";
  }

  return "bg-[linear-gradient(140deg,#5d7195,#8ca1c5,#dce3f2)]";
}
