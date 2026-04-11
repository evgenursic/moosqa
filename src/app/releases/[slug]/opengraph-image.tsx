import { ImageResponse } from "next/og";

import { SocialCard } from "@/components/social-card";
import { getReleaseBySlug } from "@/lib/sync-releases";
import { getDisplayGenre, getDisplaySummary } from "@/lib/utils";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

type ReleaseOgProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ReleaseOpenGraphImage({ params }: ReleaseOgProps) {
  const { slug } = await params;
  const release = await getReleaseBySlug(slug);

  if (!release) {
    return new ImageResponse(<SocialCard />, size);
  }

  const title =
    release.artistName && release.projectTitle
      ? `${release.artistName} - ${release.projectTitle}`
      : release.artistName || release.projectTitle || release.title;
  const description = getDisplaySummary({
    aiSummary: release.aiSummary,
    summary: release.summary,
    artistName: release.artistName,
    projectTitle: release.projectTitle,
    title: release.title,
    releaseType: release.releaseType,
    genreName: release.genreName,
  });

  return new ImageResponse(
    (
      <SocialCard
        eyebrow={getDisplayGenre(release.genreName, release.releaseType)}
        title={title}
        description={description}
        footer={`MooSQA / ${release.outletName || "indieheads radar"}`}
      />
    ),
    size,
  );
}
