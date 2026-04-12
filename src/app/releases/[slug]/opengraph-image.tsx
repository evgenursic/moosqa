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
  const imageSrc = await resolveSocialImageDataUrl(release.imageUrl || release.thumbnailUrl || null);

  return new ImageResponse(
    (
      <SocialCard
        eyebrow={getDisplayGenre(release.genreName, release.releaseType)}
        title={title}
        description={description}
        footer={`MooSQA / ${release.outletName || "indieheads radar"}`}
        imageSrc={imageSrc}
      />
    ),
    size,
  );
}

async function resolveSocialImageDataUrl(sourceUrl: string | null) {
  if (!sourceUrl) {
    return null;
  }

  try {
    const response = await fetch(sourceUrl, {
      cache: "force-cache",
      headers: {
        "user-agent": "MooSQA/1.0 (+https://moosqa-ci4e.vercel.app)",
      },
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}
