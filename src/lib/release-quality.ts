import { ArtworkStatus, GenreStatus, LinkStatus, ReleaseType } from "@/generated/prisma/enums";
import { countGenreProfileSegments, isSpecificGenreProfile } from "@/lib/genre-profile";

type ReleaseQualityInput = {
  releaseType: ReleaseType;
  genreName?: string | null;
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
};

export type ReleaseQualitySnapshot = {
  artworkStatus: ArtworkStatus;
  genreStatus: GenreStatus;
  linkStatus: LinkStatus;
  qualityScore: number;
  needsRetry: boolean;
  priorityScore: number;
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
    !input.releaseDate
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

  const checkedAgoMs = input.qualityCheckedAt
    ? Date.now() - input.qualityCheckedAt.getTime()
    : Number.POSITIVE_INFINITY;

  const retryAfterMs =
    snapshot.qualityScore < 45
      ? 1000 * 60 * 20
      : snapshot.qualityScore < 75
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
  let priority = 100 - snapshot.qualityScore;

  if (snapshot.artworkStatus === ArtworkStatus.MISSING) {
    priority += 26;
  }

  if (snapshot.genreStatus === GenreStatus.MISSING) {
    priority += 24;
  } else if (snapshot.genreStatus === GenreStatus.BASIC) {
    priority += 10;
  }

  if (snapshot.linkStatus === LinkStatus.MISSING) {
    priority += 18;
  } else if (snapshot.linkStatus === LinkStatus.PARTIAL) {
    priority += 8;
  }

  if (!input.releaseDate) {
    priority += 12;
  }

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

  return priority;
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
