import { ImageResponse } from "next/og";

import { SocialCard } from "@/components/social-card";
import { slugifyGenre } from "@/lib/archive-links";
import { getSearchGenreFacets, getSectionArchivePage } from "@/lib/release-sections";
import { resolveSocialImageDataUrl } from "@/lib/social-image";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

type TrendingGenreOgProps = {
  params: Promise<{
    genre: string;
  }>;
};

export default async function TrendingGenreOpenGraphImage({ params }: TrendingGenreOgProps) {
  const { genre: genreSlug } = await params;
  const allGenres = await getSearchGenreFacets();
  const matchedGenre = allGenres.find((genre) => slugifyGenre(genre) === genreSlug) || null;

  if (!matchedGenre) {
    return new ImageResponse(<SocialCard />, size);
  }

  const archive = await getSectionArchivePage("top-engaged", 1, matchedGenre, "trending");
  const leadRelease = archive.releases[0] || null;
  const imageSrc = await resolveSocialImageDataUrl(
    leadRelease?.imageUrl || leadRelease?.thumbnailUrl || null,
  );

  return new ImageResponse(
    (
      <SocialCard
        eyebrow="Trending genre"
        title={matchedGenre}
        description={`Audience momentum archive for ${matchedGenre.toLowerCase()} releases on MooSQA.`}
        footer={`MooSQA / ${archive.total} matching posts`}
        imageSrc={imageSrc}
      />
    ),
    size,
  );
}
