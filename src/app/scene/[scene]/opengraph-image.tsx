import { ImageResponse } from "next/og";

import { SocialCard } from "@/components/social-card";
import { getSceneArchivePage } from "@/lib/analytics";
import { isDiscoverySceneSlug } from "@/lib/discovery-scenes";
import { resolveSocialImageDataUrl } from "@/lib/social-image";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

type SceneOgProps = {
  params: Promise<{
    scene: string;
  }>;
};

export default async function SceneOpenGraphImage({ params }: SceneOgProps) {
  const { scene } = await params;
  if (!isDiscoverySceneSlug(scene)) {
    return new ImageResponse(<SocialCard />, size);
  }

  const archive = await getSceneArchivePage(scene, 1);
  if (!archive) {
    return new ImageResponse(<SocialCard />, size);
  }

  const leadRelease = archive.entries[0]?.release || null;
  const imageSrc = await resolveSocialImageDataUrl(
    leadRelease?.imageUrl || leadRelease?.thumbnailUrl || null,
  );

  return new ImageResponse(
    (
      <SocialCard
        eyebrow={archive.kicker}
        title={archive.title}
        description={archive.description}
        footer={`MooSQA / ${archive.total} matching posts`}
        imageSrc={imageSrc}
      />
    ),
    size,
  );
}
