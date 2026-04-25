import { FollowTargetType, ReleaseType } from "@/generated/prisma/enums";
import { ensureDatabase } from "@/lib/database";
import { applyReleaseEditorialFields, buildVisibleReleaseWhere } from "@/lib/editorial";
import { prisma } from "@/lib/prisma";

export type RadarRecommendation = {
  id: string;
  slug: string;
  title: string;
  artistName: string | null;
  projectTitle: string | null;
  labelName: string | null;
  genreName: string | null;
  publishedAt: Date;
  youtubeViewCount: number | null;
  redditUpvotes: number | null;
  redditComments: number | null;
  reasons: string[];
  score: number;
};

type RecommendationCandidate = {
  id: string;
  slug: string;
  title: string;
  artistName: string | null;
  projectTitle: string | null;
  releaseType: ReleaseType;
  labelName: string | null;
  genreName: string | null;
  genreOverride: string | null;
  publishedAt: Date;
  qualityScore: number;
  score: number | null;
  youtubeViewCount: number | null;
  openCount: number;
  shareCount: number;
  listenClickCount: number;
  positiveReactionCount: number;
  commentCount: number | null;
  isFeatured: boolean;
  editorialRank: number;
};

type SavedReleaseSignal = {
  artistName: string | null;
  labelName: string | null;
  genreName: string | null;
  genreOverride: string | null;
};

type RecommendationSignals = {
  followedArtists: Set<string>;
  followedLabels: Set<string>;
  followedGenres: Set<string>;
  savedArtistWeights: Map<string, number>;
  savedLabelWeights: Map<string, number>;
  savedGenreWeights: Map<string, number>;
};

export async function getRecommendedReleasesForUser(userId: string) {
  await ensureDatabase();

  const [follows, savedReleases] = await Promise.all([
    prisma.userFollow.findMany({
      where: { userId },
      select: {
        targetType: true,
        targetValue: true,
      },
    }),
    prisma.userSavedRelease.findMany({
      where: { userId },
      take: 36,
      orderBy: [{ createdAt: "desc" }],
      select: {
        releaseId: true,
        release: {
          select: {
            artistName: true,
            labelName: true,
            genreName: true,
            genreOverride: true,
          },
        },
      },
    }),
  ]);

  const savedIds = new Set(savedReleases.map((entry) => entry.releaseId));
  const signals = buildRecommendationSignals({
    follows,
    savedReleases: savedReleases.map((entry) => entry.release),
  });

  const candidates = await prisma.release.findMany({
    where: buildVisibleReleaseWhere({
      publishedAt: {
        gte: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      },
      id: {
        notIn: [...savedIds],
      },
    }),
    orderBy: [{ publishedAt: "desc" }],
    take: 120,
    select: {
      id: true,
      slug: true,
      title: true,
      artistName: true,
      projectTitle: true,
      releaseType: true,
      labelName: true,
      genreName: true,
      genreOverride: true,
      publishedAt: true,
      qualityScore: true,
      score: true,
      youtubeViewCount: true,
      openCount: true,
      shareCount: true,
      listenClickCount: true,
      positiveReactionCount: true,
      commentCount: true,
      isFeatured: true,
      editorialRank: true,
    },
  });

  const scored = candidates
    .map((candidate) => scoreRecommendationCandidate(applyReleaseEditorialFields(candidate), signals))
    .filter((candidate): candidate is RadarRecommendation => Boolean(candidate))
    .sort((left, right) => right.score - left.score || right.publishedAt.getTime() - left.publishedAt.getTime());

  return selectDiverseRecommendations(scored, 8);
}

export function buildRecommendationSignals({
  follows,
  savedReleases,
}: {
  follows: Array<{
    targetType: FollowTargetType;
    targetValue: string;
  }>;
  savedReleases: SavedReleaseSignal[];
}): RecommendationSignals {
  const followedArtists = new Set(
    follows
      .filter((follow) => follow.targetType === FollowTargetType.ARTIST)
      .map((follow) => normalizeSignalKey(follow.targetValue))
      .filter((value): value is string => Boolean(value)),
  );
  const followedLabels = new Set(
    follows
      .filter((follow) => follow.targetType === FollowTargetType.LABEL)
      .map((follow) => normalizeSignalKey(follow.targetValue))
      .filter((value): value is string => Boolean(value)),
  );
  const followedGenres = new Set(
    follows
      .filter((follow) => follow.targetType === FollowTargetType.GENRE)
      .map((follow) => normalizeSignalKey(follow.targetValue))
      .filter((value): value is string => Boolean(value)),
  );

  return {
    followedArtists,
    followedLabels,
    followedGenres,
    savedArtistWeights: accumulateSignalWeights(savedReleases.map((entry) => entry.artistName)),
    savedLabelWeights: accumulateSignalWeights(savedReleases.map((entry) => entry.labelName)),
    savedGenreWeights: accumulateSignalWeights(
      savedReleases.map((entry) => entry.genreOverride || entry.genreName),
    ),
  };
}

export function scoreRecommendationCandidate(
  candidate: RecommendationCandidate,
  signals: RecommendationSignals,
): RadarRecommendation | null {
  const reasons = new Set<string>();
  let score = 0;

  const artistKey = normalizeSignalKey(candidate.artistName);
  const labelKey = normalizeSignalKey(candidate.labelName);
  const genreKey = normalizeSignalKey(candidate.genreName);

  if (artistKey && signals.followedArtists.has(artistKey)) {
    reasons.add("followed artist");
    score += 420;
  }
  if (labelKey && signals.followedLabels.has(labelKey)) {
    reasons.add("followed label");
    score += 260;
  }
  if (genreKey && signals.followedGenres.has(genreKey)) {
    reasons.add("followed genre");
    score += 170;
  }

  const savedArtistWeight = readSignalWeight(signals.savedArtistWeights, artistKey);
  const savedLabelWeight = readSignalWeight(signals.savedLabelWeights, labelKey);
  const savedGenreWeight = readSignalWeight(signals.savedGenreWeights, genreKey);

  if (savedArtistWeight > 0) {
    reasons.add("saved artist lane");
    score += Math.min(savedArtistWeight, 3) * 85;
  }
  if (savedLabelWeight > 0) {
    reasons.add("saved label lane");
    score += Math.min(savedLabelWeight, 3) * 44;
  }
  if (savedGenreWeight > 0) {
    reasons.add("saved genre");
    score += Math.min(savedGenreWeight, 3) * 58;
  }
  if (candidate.isFeatured) {
    reasons.add("editor pick");
    score += 90 + candidate.editorialRank * 4;
  }

  const productTractionScore =
    Math.min(candidate.openCount, 60) * 0.8 +
    Math.min(candidate.listenClickCount, 24) * 2.2 +
    Math.min(candidate.shareCount, 12) * 5 +
    Math.min(candidate.positiveReactionCount, 16) * 4;
  const redditTractionScore =
    Math.log1p(Math.max(candidate.score || 0, 0)) * 12 +
    Math.min(candidate.commentCount || 0, 36) * 1.5;
  const youtubeTractionScore = Math.min(Math.log1p(Math.max(candidate.youtubeViewCount || 0, 0)) * 5, 72);

  if (candidate.openCount >= 18 || candidate.listenClickCount >= 8 || candidate.shareCount >= 4) {
    reasons.add("detail interest");
  }
  if ((candidate.score || 0) >= 25 || (candidate.commentCount || 0) >= 8) {
    reasons.add("Reddit traction");
  }
  if ((candidate.youtubeViewCount || 0) >= 25_000) {
    reasons.add("YouTube traction");
  }

  score += Math.max(0, Math.min(candidate.qualityScore, 100));
  score += productTractionScore;
  score += redditTractionScore;
  score += youtubeTractionScore;
  score += computeReleaseTypeBonus(candidate.releaseType);
  score += computeRecencyBonus(candidate.publishedAt);

  if (reasons.size === 0 && score < 150) {
    return null;
  }

  return {
    id: candidate.id,
    slug: candidate.slug,
    title: candidate.title,
    artistName: candidate.artistName,
    projectTitle: candidate.projectTitle,
    labelName: candidate.labelName,
    genreName: candidate.genreName,
    publishedAt: candidate.publishedAt,
    youtubeViewCount: candidate.youtubeViewCount,
    redditUpvotes: candidate.score,
    redditComments: candidate.commentCount,
    reasons: [...reasons].slice(0, 3),
    score: Math.round(score),
  };
}

export function selectDiverseRecommendations(
  candidates: RadarRecommendation[],
  limit: number,
): RadarRecommendation[] {
  const remaining = [...candidates];
  const selected: RadarRecommendation[] = [];

  while (remaining.length > 0 && selected.length < limit) {
    let bestIndex = -1;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const adjustedScore = candidate.score - computeDiversityPenalty(candidate, selected);
      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        bestIndex = index;
      }
    }

    if (bestIndex === -1 || bestScore < 120) {
      break;
    }

    const [next] = remaining.splice(bestIndex, 1);
    if (!next) {
      break;
    }

    selected.push(next);
  }

  return selected;
}

function accumulateSignalWeights(values: Array<string | null>) {
  const weights = new Map<string, number>();

  for (const value of values) {
    const key = normalizeSignalKey(value);
    if (!key) {
      continue;
    }

    weights.set(key, (weights.get(key) || 0) + 1);
  }

  return weights;
}

function readSignalWeight(weights: Map<string, number>, key: string | null) {
  if (!key) {
    return 0;
  }

  return weights.get(key) || 0;
}

function computeDiversityPenalty(candidate: RadarRecommendation, selected: RadarRecommendation[]) {
  const artistKey = normalizeSignalKey(candidate.artistName);
  const labelKey = normalizeSignalKey(candidate.labelName);
  const genreKey = normalizeSignalKey(candidate.genreName);

  let penalty = 0;
  let artistMatches = 0;
  let genreMatches = 0;

  for (const existing of selected) {
    if (artistKey && artistKey === normalizeSignalKey(existing.artistName)) {
      artistMatches += 1;
      penalty += 150;
    }
    if (labelKey && labelKey === normalizeSignalKey(existing.labelName)) {
      penalty += 55;
    }
    if (genreKey && genreKey === normalizeSignalKey(existing.genreName)) {
      genreMatches += 1;
      penalty += 28;
    }
  }

  if (artistMatches >= 2) {
    penalty += 240;
  }
  if (genreMatches >= 3) {
    penalty += 120;
  }

  return penalty;
}

function normalizeSignalKey(value: string | null | undefined) {
  if (!value || !value.trim()) {
    return null;
  }

  return value.trim().toLowerCase();
}

function computeRecencyBonus(publishedAt: Date) {
  const ageHours = Math.max(1, (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60));

  if (ageHours <= 24) {
    return 74;
  }
  if (ageHours <= 72) {
    return 52;
  }
  if (ageHours <= 168) {
    return 30;
  }
  if (ageHours <= 336) {
    return 16;
  }

  return 6;
}

function computeReleaseTypeBonus(releaseType: ReleaseType) {
  switch (releaseType) {
    case ReleaseType.ALBUM:
      return 32;
    case ReleaseType.EP:
      return 22;
    case ReleaseType.SINGLE:
      return 14;
    case ReleaseType.PERFORMANCE:
    case ReleaseType.LIVE_SESSION:
      return 10;
    default:
      return 0;
  }
}
