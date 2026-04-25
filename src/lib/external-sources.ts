import { ReleaseExternalSourceType } from "@/generated/prisma/enums";
import { normalizePublicHttpUrl } from "@/lib/safe-url";

export type ExternalSourceInput = {
  id: string;
  sourceName: string;
  sourceUrl: string;
  title: string;
  summary?: string | null;
  sourceType: ReleaseExternalSourceType;
  publishedAt?: Date | string | null;
  isVisible?: boolean;
};

export type VisibleExternalSource = Omit<ExternalSourceInput, "sourceUrl" | "sourceName" | "title" | "summary"> & {
  sourceUrl: string;
  sourceName: string;
  title: string;
  summary: string | null;
};

export function getVisibleExternalSources(
  sources: ExternalSourceInput[] | null | undefined,
): VisibleExternalSource[] {
  return (sources || [])
    .filter((source) => source.isVisible !== false)
    .map((source) => ({
      ...source,
      sourceUrl: normalizePublicHttpUrl(source.sourceUrl),
      sourceName: source.sourceName.trim(),
      title: source.title.trim(),
      summary: source.summary?.trim() || null,
    }))
    .filter((source): source is VisibleExternalSource => Boolean(source.sourceUrl && source.sourceName && source.title));
}

export function formatExternalSourceTypeLabel(type: ReleaseExternalSourceType) {
  switch (type) {
    case ReleaseExternalSourceType.REVIEW:
      return "Review";
    case ReleaseExternalSourceType.FEATURE:
      return "Feature";
    case ReleaseExternalSourceType.INTERVIEW:
      return "Interview";
    case ReleaseExternalSourceType.NEWS:
      return "News";
    case ReleaseExternalSourceType.OFFICIAL:
      return "Official";
    case ReleaseExternalSourceType.USER_CURATED:
      return "Curated source";
  }
}
