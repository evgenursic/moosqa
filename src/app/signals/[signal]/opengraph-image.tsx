import { ImageResponse } from "next/og";

import { SocialCard } from "@/components/social-card";
import {
  parseSignalArchiveTimeframe,
  type SignalArchiveSlug,
} from "@/lib/archive-links";
import { getSignalArchivePage } from "@/lib/analytics";
import { resolveSocialImageDataUrl } from "@/lib/social-image";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

type SignalOgProps = {
  params: Promise<{
    signal: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignalOpenGraphImage({
  params,
  searchParams,
}: SignalOgProps) {
  const { signal } = await params;
  if (!isSignalArchiveSlug(signal)) {
    return new ImageResponse(<SocialCard />, size);
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const timeframe = parseSignalArchiveTimeframe(
    resolvedSearchParams.window,
    signal === "opened" ? "today" : "7d",
  );
  const archive = await getSignalArchivePage(signal, 1, timeframe);
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
        footer={`MooSQA / ${archive.total} ranked releases`}
        imageSrc={imageSrc}
      />
    ),
    size,
  );
}

function isSignalArchiveSlug(value: string): value is SignalArchiveSlug {
  return (
    value === "opened" ||
    value === "shared" ||
    value === "listened" ||
    value === "liked" ||
    value === "disliked" ||
    value === "discussed"
  );
}
