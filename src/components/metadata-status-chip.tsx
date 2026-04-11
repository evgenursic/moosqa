import { ReleaseType } from "@/generated/prisma/enums";
import { getPublicMetadataStatus } from "@/lib/release-quality";
import { cn } from "@/lib/utils";

type MetadataStatusChipProps = {
  release: {
    releaseType: ReleaseType;
    qualityScore: number;
    imageUrl?: string | null;
    thumbnailUrl?: string | null;
    youtubeUrl?: string | null;
    youtubeMusicUrl?: string | null;
    bandcampUrl?: string | null;
    officialWebsiteUrl?: string | null;
    officialStoreUrl?: string | null;
    genreName?: string | null;
    releaseDate?: Date | null;
  };
  className?: string;
};

export function MetadataStatusChip({
  release,
  className,
}: MetadataStatusChipProps) {
  const status = getPublicMetadataStatus({
    releaseType: release.releaseType,
    genreName: release.genreName,
    imageUrl: release.imageUrl,
    thumbnailUrl: release.thumbnailUrl,
    youtubeUrl: release.youtubeUrl,
    youtubeMusicUrl: release.youtubeMusicUrl,
    bandcampUrl: release.bandcampUrl,
    officialWebsiteUrl: release.officialWebsiteUrl,
    officialStoreUrl: release.officialStoreUrl,
    releaseDate: release.releaseDate,
  });

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em]",
        status.tone === "complete" &&
          "border-emerald-700/20 bg-emerald-500/10 text-emerald-900",
        status.tone === "strong" &&
          "border-sky-700/18 bg-sky-500/8 text-sky-900",
        status.tone === "building" &&
          "border-amber-700/18 bg-amber-500/10 text-amber-950",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status.tone === "complete" && "bg-emerald-600",
          status.tone === "strong" && "bg-sky-600",
          status.tone === "building" && "bg-amber-500",
        )}
      />
      {status.label}
    </span>
  );
}
