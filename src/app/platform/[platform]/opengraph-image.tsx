import { ImageResponse } from "next/og";

import { SocialCard } from "@/components/social-card";
import { getPlatformArchivePage, getPlatformLabelFromSlug } from "@/lib/analytics";
import { type PlatformArchiveSlug } from "@/lib/archive-links";
import { resolveSocialImageDataUrl } from "@/lib/social-image";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

type PlatformOgProps = {
  params: Promise<{
    platform: string;
  }>;
};

export default async function PlatformOpenGraphImage({ params }: PlatformOgProps) {
  const { platform } = await params;
  if (!isPlatformArchiveSlug(platform)) {
    return new ImageResponse(<SocialCard />, size);
  }

  const archive = await getPlatformArchivePage(platform, 1, "7d");
  const leadRelease = archive.entries[0]?.release || null;
  const imageSrc = await resolveSocialImageDataUrl(
    leadRelease?.imageUrl || leadRelease?.thumbnailUrl || null,
  );

  return new ImageResponse(
    (
      <SocialCard
        eyebrow="Platform leaderboard"
        title={`${getPlatformLabelFromSlug(platform)} trending`}
        description={archive.description}
        footer={`MooSQA / ${archive.total} ranked releases`}
        imageSrc={imageSrc}
      />
    ),
    size,
  );
}

function isPlatformArchiveSlug(value: string): value is PlatformArchiveSlug {
  return value === "bandcamp" || value === "youtube" || value === "youtube-music";
}
