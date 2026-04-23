import type { Prisma } from "@/generated/prisma/client";

type EditorialReleaseFields = {
  isHidden?: boolean;
  isFeatured?: boolean;
  editorialRank?: number;
  genreName?: string | null;
  genreOverride?: string | null;
  summary?: string | null;
  summaryOverride?: string | null;
  imageUrl?: string | null;
  imageUrlOverride?: string | null;
  sourceUrl?: string;
  sourceUrlOverride?: string | null;
};

export function applyReleaseEditorialFields<T extends EditorialReleaseFields>(release: T) {
  return {
    ...release,
    genreName: release.genreOverride?.trim() || release.genreName || null,
    summary: release.summaryOverride?.trim() || release.summary || null,
    imageUrl: release.imageUrlOverride?.trim() || release.imageUrl || null,
    sourceUrl: release.sourceUrlOverride?.trim() || release.sourceUrl || "",
  };
}

export function buildVisibleReleaseWhere(
  where?: Prisma.ReleaseWhereInput,
): Prisma.ReleaseWhereInput {
  if (!where || Object.keys(where).length === 0) {
    return { isHidden: false };
  }

  return {
    AND: [{ isHidden: false }, where],
  };
}
