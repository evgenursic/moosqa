import { ArtworkStatus, GenreStatus, LinkStatus, ReleaseType } from "@/generated/prisma/enums";
import { countGenreProfileSegments, isSpecificGenreProfile } from "@/lib/genre-profile";
import { scoreSummaryQuality } from "@/lib/summary-quality";

type ReleaseQualityInput = {
  releaseType: ReleaseType;
  aiSummary?: string | null;
  artistName?: string | null;
  projectTitle?: string | null;
  title?: string | null;
  genreName?: string | null;
  genreConfidence?: number | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  youtubeUrl?: string | null;
  youtubeMusicUrl?: string | null;
  bandcampUrl?: string | null;
  officialWebsiteUrl?: string | null;
  officialStoreUrl?: string | null;
  releaseDate?: Date | null;
  publishedAt?: Date | null;
  qualityCheckedAt?: Date | null;
  metadataEnrichedAt?: Date | null;
  summaryQualityScore?: number | null;
};

export type ReleaseQualitySnapshot = {
  artworkStatus: ArtworkStatus;
  genreStatus: GenreStatus;
  linkStatus: LinkStatus;
  qualityScore: number;
  needsRetry: boolean;
  priorityScore: number;
};

export type ReleaseQualityIssueCode =
  | "missing_artwork"
  | "basic_artwork"
  | "missing_genre"
  | "basic_genre"
  | "low_genre_confidence"
  | "missing_links"
  | "partial_links"
  | "missing_release_date"
  | "low_summary_quality";

export type ReleaseQualityIssue = {
  code: ReleaseQualityIssueCode;
  label: string;
};

const QUALITY_ISSUE_PRIORITY_WEIGHT: Record<ReleaseQualityIssueCode, number> = {
  missing_artwork: 32,
  basic_artwork: 12,
  missing_genre: 30,
  basic_genre: 14,
  low_genre_confidence: 18,
  missing_links: 22,
  partial_links: 8,
  missing_release_date: 14,
  low_summary_quality: 18,
};

export type PublicMetadataStatus = {
  label: string;
  tone: "complete" | "strong" | "building";
};

export function assessReleaseQuality(input: ReleaseQualityInput): ReleaseQualitySnapshot {
  const artworkStatus = getArtworkStatus(input);
  const genreStatus = getGenreStatus(input);
  const linkStatus = getLinkStatus(input);
  const qualityScore = scoreReleaseQuality(input, {
    artworkStatus,
    genreStatus,
    linkStatus,
  });

  return {
    artworkStatus,
    genreStatus,
    linkStatus,
    qualityScore,
    needsRetry: shouldRetryForQuality(input, {
      artworkStatus,
      genreStatus,
      linkStatus,
      qualityScore,
    }),
    priorityScore: getQualityPriority(input, {
      artworkStatus,
      genreStatus,
      linkStatus,
      qualityScore,
    }),
  };
}

export function isWeakQualityRelease(input: ReleaseQualityInput) {
  const artworkStatus = getArtworkStatus(input);
  const genreStatus = getGenreStatus(input);
  const linkStatus = getLinkStatus(input);

  return (
    artworkStatus !== ArtworkStatus.STRONG ||
    genreStatus !== GenreStatus.STRONG ||
    linkStatus !== LinkStatus.STRONG ||
    !input.releaseDate ||
    (input.genreConfidence ?? 0) < 70 ||
    getEffectiveSummaryQualityScore(input) < 72
  );
}

export function getReleaseQualityIssues(input: ReleaseQualityInput): ReleaseQualityIssue[] {
  const artworkStatus = getArtworkStatus(input);
  const genreStatus = getGenreStatus(input);
  const linkStatus = getLinkStatus(input);
  const issues: ReleaseQualityIssue[] = [];

  if (artworkStatus === ArtworkStatus.MISSING) {
    issues.push({ code: "missing_artwork", label: "Missing artwork" });
  } else if (artworkStatus === ArtworkStatus.BASIC) {
    issues.push({ code: "basic_artwork", label: "Basic artwork only" });
  }

  if (genreStatus === GenreStatus.MISSING) {
    issues.push({ code: "missing_genre", label: "Missing genre" });
  } else if (genreStatus === GenreStatus.BASIC) {
    issues.push({ code: "basic_genre", label: "Generic genre" });
  }

  if ((input.genreConfidence ?? 100) < 70) {
    issues.push({ code: "low_genre_confidence", label: "Low genre confidence" });
  }

  if (linkStatus === LinkStatus.MISSING) {
    issues.push({ code: "missing_links", label: "Missing listen/buy links" });
  } else if (linkStatus === LinkStatus.PARTIAL) {
    issues.push({ code: "partial_links", label: "Partial listen/buy links" });
  }

  if (!input.releaseDate) {
    issues.push({ code: "missing_release_date", label: "Missing release date" });
  }

  if (getEffectiveSummaryQualityScore(input) < 72) {
    issues.push({ code: "low_summary_quality", label: "Low summary quality" });
  }

  return issues;
}

export function getReleaseQualityIssuePriority(input: ReleaseQualityInput) {
  return getReleaseQualityIssues(input).reduce(
    (priority, issue) => priority + QUALITY_ISSUE_PRIORITY_WEIGHT[issue.code],
    0,
  );
}

export function getPublicMetadataStatus(input: ReleaseQualityInput): PublicMetadataStatus {
  const snapshot = assessReleaseQuality(input);
  const hasReleaseDate = Boolean(input.releaseDate);

  if (
    hasReleaseDate &&
    snapshot.artworkStatus === ArtworkStatus.STRONG &&
    snapshot.genreStatus === GenreStatus.STRONG &&
    snapshot.linkStatus === LinkStatus.STRONG &&
    snapshot.qualityScore >= 90
  ) {
    return {
      label: "Metadata complete",
      tone: "complete",
    };
  }

  if (
    snapshot.qualityScore >= 72 &&
    snapshot.genreStatus !== GenreStatus.MISSING &&
    (snapshot.linkStatus !== LinkStatus.MISSING || hasReleaseDate)
  ) {
    return {
      label: "Metadata strong",
      tone: "strong",
    };
  }

  return {
    label: "Metadata improving",
    tone: "building",
  };
}

function getArtworkStatus(input: ReleaseQualityInput) {
  if (isUsableAsset(input.imageUrl)) {
    return ArtworkStatus.STRONG;
  }

  if (isUsableAsset(input.thumbnailUrl)) {
    return ArtworkStatus.BASIC;
  }

  return ArtworkStatus.MISSING;
}

function getGenreStatus(input: ReleaseQualityInput) {
  const genreName = normalizeGenre(input.genreName);
  if (!genreName) {
    return GenreStatus.MISSING;
  }

  if (isSpecificGenreProfile(genreName)) {
    return GenreStatus.STRONG;
  }

  return GenreStatus.BASIC;
}

function getLinkStatus(input: ReleaseQualityInput) {
  const listeningLinks = countTruthy(input.youtubeUrl, input.youtubeMusicUrl, input.bandcampUrl);
  const purchaseLinks = countTruthy(
    input.bandcampUrl,
    input.officialStoreUrl,
    input.officialWebsiteUrl,
  );

  if (isPurchasableReleaseType(input.releaseType)) {
    if (listeningLinks >= 2 && purchaseLinks >= 1) {
      return LinkStatus.STRONG;
    }

    if (listeningLinks >= 1 || purchaseLinks >= 1) {
      return LinkStatus.PARTIAL;
    }

    return LinkStatus.MISSING;
  }

  if (listeningLinks >= 1) {
    return LinkStatus.STRONG;
  }

  if (purchaseLinks >= 1) {
    return LinkStatus.PARTIAL;
  }

  return LinkStatus.MISSING;
}

function scoreReleaseQuality(
  input: ReleaseQualityInput,
  statuses: {
    artworkStatus: ArtworkStatus;
    genreStatus: GenreStatus;
    linkStatus: LinkStatus;
  },
) {
  let score = 0;

  score +=
    statuses.artworkStatus === ArtworkStatus.STRONG
      ? 35
      : statuses.artworkStatus === ArtworkStatus.BASIC
        ? 20
        : 0;

  score +=
    statuses.genreStatus === GenreStatus.STRONG
      ? 35
      : statuses.genreStatus === GenreStatus.BASIC
        ? 16
        : 0;

  const genreSegments = countGenreProfileSegments(normalizeGenre(input.genreName));
  if (statuses.genreStatus === GenreStatus.STRONG && genreSegments >= 2) {
    score += 5;
  }

  score +=
    statuses.linkStatus === LinkStatus.STRONG
      ? 20
      : statuses.linkStatus === LinkStatus.PARTIAL
        ? 10
        : 0;

  if (input.releaseDate) {
    score += 10;
  }

  return Math.min(score, 100);
}

function shouldRetryForQuality(
  input: ReleaseQualityInput,
  snapshot: {
    artworkStatus: ArtworkStatus;
    genreStatus: GenreStatus;
    linkStatus: LinkStatus;
    qualityScore: number;
  },
) {
  const weakCard = isWeakQualityRelease(input);

  if (!weakCard) {
    return false;
  }

  const summaryQualityScore = getEffectiveSummaryQualityScore(input);
  const checkedAgoMs = input.qualityCheckedAt
    ? Date.now() - input.qualityCheckedAt.getTime()
    : Number.POSITIVE_INFINITY;

  const retryAfterMs =
    snapshot.qualityScore < 45 || (input.genreConfidence ?? 0) < 55 || summaryQualityScore < 60
      ? 1000 * 60 * 20
      : snapshot.qualityScore < 75 || (input.genreConfidence ?? 0) < 72 || summaryQualityScore < 72
        ? 1000 * 60 * 60 * 2
        : 1000 * 60 * 60 * 8;

  return checkedAgoMs >= retryAfterMs;
}

function getQualityPriority(
  input: ReleaseQualityInput,
  snapshot: {
    artworkStatus: ArtworkStatus;
    genreStatus: GenreStatus;
    linkStatus: LinkStatus;
    qualityScore: number;
  },
) {
  let priority = 100 - snapshot.qualityScore + getReleaseQualityIssuePriority(input);
  const summaryQualityScore = getEffectiveSummaryQualityScore(input);

  const ageHours = input.publishedAt
    ? (Date.now() - input.publishedAt.getTime()) / (1000 * 60 * 60)
    : 999;
  if (ageHours <= 24) {
    priority += 20;
  } else if (ageHours <= 72) {
    priority += 10;
  } else if (ageHours > 336) {
    priority -= 12;
  }

  if (!input.metadataEnrichedAt) {
    priority += 8;
  }

  if (summaryQualityScore < 60) {
    priority += 16;
  } else if (summaryQualityScore < 72) {
    priority += 8;
  }

  return priority;
}

export function getEffectiveSummaryQualityScore(input: ReleaseQualityInput) {
  if ("aiSummary" in input) {
    return scoreSummaryQuality({
      summary: input.aiSummary,
      artistName: input.artistName,
      projectTitle: input.projectTitle,
      title: input.title,
    });
  }

  return input.summaryQualityScore ?? 100;
}

function normalizeGenre(value: string | null | undefined) {
  const normalized = value?.trim() || "";
  return normalized || null;
}

function isUsableAsset(value: string | null | undefined) {
  const normalized = value?.trim() || "";
  if (!normalized) {
    return false;
  }

  return !normalized.startsWith("data:");
}

function countTruthy(...values: Array<string | null | undefined>) {
  return values.filter((value) => Boolean(value?.trim())).length;
}

function isPurchasableReleaseType(releaseType: ReleaseType) {
  return (
    releaseType === ReleaseType.SINGLE ||
    releaseType === ReleaseType.ALBUM ||
    releaseType === ReleaseType.EP
  );
}
