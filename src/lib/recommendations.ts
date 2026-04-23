import { FollowTargetType } from "@/generated/prisma/enums";
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
  reasons: string[];
  score: number;
};

type RecommendationCandidate = {
  id: string;
  slug: string;
  title: string;
  artistName: string | null;
  projectTitle: string | null;
  labelName: string | null;
  genreName: string | null;
  genreOverride: string | null;
  publishedAt: Date;
  qualityScore: number;
  openCount: number;
  shareCount: number;
  listenClickCount: number;
  positiveReactionCount: number;
  isFeatured: boolean;
  editorialRank: number;
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
            genreName: true,
          },
        },
      },
    }),
  ]);

  const savedIds = new Set(savedReleases.map((entry) => entry.releaseId));
  const followedArtists = new Set(
    follows
      .filter((follow) => follow.targetType === FollowTargetType.ARTIST)
      .map((follow) => follow.targetValue),
  );
  const followedLabels = new Set(
    follows
      .filter((follow) => follow.targetType === FollowTargetType.LABEL)
      .map((follow) => follow.targetValue),
  );
  const genreSignals = new Set(
    savedReleases
      .map((entry) => entry.release.genreName)
      .filter((value): value is string => Boolean(value?.trim())),
  );

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
    take: 90,
    select: {
      id: true,
      slug: true,
      title: true,
      artistName: true,
      projectTitle: true,
      labelName: true,
      genreName: true,
      genreOverride: true,
      publishedAt: true,
      qualityScore: true,
      openCount: true,
      shareCount: true,
      listenClickCount: true,
      positiveReactionCount: true,
      isFeatured: true,
      editorialRank: true,
    },
  });

  return candidates
    .map((candidate) => scoreRecommendation(applyReleaseEditorialFields(candidate), {
      followedArtists,
      followedLabels,
      genreSignals,
    }))
    .filter((candidate): candidate is RadarRecommendation => Boolean(candidate))
    .sort((left, right) => right.score - left.score || right.publishedAt.getTime() - left.publishedAt.getTime())
    .slice(0, 8);
}

function scoreRecommendation(
  candidate: RecommendationCandidate,
  signals: {
    followedArtists: Set<string>;
    followedLabels: Set<string>;
    genreSignals: Set<string>;
  },
): RadarRecommendation | null {
  const reasons: string[] = [];
  let score = 0;

  if (candidate.artistName && signals.followedArtists.has(candidate.artistName)) {
    reasons.push("followed artist");
    score += 420;
  }
  if (candidate.labelName && signals.followedLabels.has(candidate.labelName)) {
    reasons.push("followed label");
    score += 260;
  }
  if (candidate.genreName && signals.genreSignals.has(candidate.genreName)) {
    reasons.push("saved genre");
    score += 130;
  }
  if (candidate.isFeatured) {
    reasons.push("editor pick");
    score += 90 + candidate.editorialRank * 4;
  }

  score += Math.max(0, Math.min(candidate.qualityScore, 100));
  score += Math.min(candidate.openCount, 40);
  score += Math.min(candidate.listenClickCount, 20) * 2;
  score += Math.min(candidate.shareCount, 10) * 5;
  score += Math.min(candidate.positiveReactionCount, 12) * 4;
  score += computeRecencyBonus(candidate.publishedAt);

  if (reasons.length === 0 && score < 130) {
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
    reasons: reasons.slice(0, 3),
    score,
  };
}

function computeRecencyBonus(publishedAt: Date) {
  const ageHours = Math.max(1, (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60));

  if (ageHours <= 24) {
    return 70;
  }
  if (ageHours <= 72) {
    return 48;
  }
  if (ageHours <= 168) {
    return 26;
  }

  return 8;
}
