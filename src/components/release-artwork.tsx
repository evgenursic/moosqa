/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

type ReleaseArtworkProps = {
  title: string;
  artistName: string | null;
  projectTitle: string | null;
  imageUrl: string | null;
  genreName?: string | null;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
};

export function ReleaseArtwork({
  title,
  imageUrl,
  genreName,
  className,
  imageClassName,
  priority = false,
}: ReleaseArtworkProps) {
  const accent = getArtworkAccent(genreName);

  return (
    <div className={cn("relative overflow-hidden border border-[var(--color-line)] bg-[var(--color-panel)]", className)}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={title}
          className={cn("h-full w-full object-cover", imageClassName)}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "low"}
        />
      ) : (
        <div className={cn("relative h-full min-h-[18rem]", accent, imageClassName)}>
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
