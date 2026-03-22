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
  badgeClassName?: string;
  priority?: boolean;
};

export function ReleaseArtwork({
  title,
  artistName,
  projectTitle,
  imageUrl,
  genreName,
  className,
  imageClassName,
  badgeClassName,
  priority = false,
}: ReleaseArtworkProps) {
  const displayTitle = artistName || projectTitle || title;
  const accent = getArtworkAccent(genreName);

  return (
    <div className={cn("relative overflow-hidden border border-[var(--color-line)] bg-[var(--color-panel)]", className)}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={title}
          className={cn("h-full w-full object-cover", imageClassName)}
          loading={priority ? "eager" : "lazy"}
        />
      ) : (
        <div className={cn("flex h-full min-h-[18rem] items-end p-6", accent, imageClassName)}>
          <div className="max-w-[22rem]">
            <p className="section-kicker text-white/60">{genreName || "New release"}</p>
            <p className="mt-3 text-4xl leading-[0.92] text-white serif-display">{displayTitle}</p>
          </div>
        </div>
      )}

      <div className={cn("absolute left-4 top-4 border border-black/10 bg-[var(--color-paper)]/92 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink)] backdrop-blur", badgeClassName)}>
        {genreName || "Genre pending"}
      </div>
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
