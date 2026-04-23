import { FollowTargetType } from "@/generated/prisma/enums";

import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";

export type AuthUserProfileInput = {
  id: string;
  email?: string | null;
  displayName?: string | null;
};

export const DEFAULT_USER_PREFERENCES = {
  emailNotifications: false,
  dailyDigest: false,
  weeklyDigest: true,
  instantAlerts: false,
  preferredGenres: [] as string[],
};

export function normalizeUserEmail(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() || "";
  return normalized || null;
}

export function normalizeDisplayName(value: string | null | undefined) {
  const normalized = value?.replace(/\s+/g, " ").trim() || "";
  return normalized.slice(0, 80) || null;
}

export function normalizeFollowTargetValue(value: string | null | undefined) {
  return (
    value
      ?.toLowerCase()
      .normalize("NFKD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^\p{L}\p{N}&+.'\s-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim() || ""
  );
}

export function buildUserProfileSeed(input: AuthUserProfileInput) {
  const id = input.id.trim();
  if (!id) {
    throw new Error("User id is required.");
  }

  return {
    id,
    email: normalizeUserEmail(input.email),
    displayName: normalizeDisplayName(input.displayName),
  };
}

export type ReleaseFollowTarget = {
  targetType: FollowTargetType;
  targetValue: string;
  normalizedValue: string;
};

export function buildReleaseFollowTargets(input: {
  artistName?: string | null;
  labelName?: string | null;
}) {
  const seeds = [
    { targetType: FollowTargetType.ARTIST, targetValue: input.artistName },
    { targetType: FollowTargetType.LABEL, targetValue: input.labelName },
  ];
  const seen = new Set<string>();
  const targets: ReleaseFollowTarget[] = [];

  for (const seed of seeds) {
    const targetValue = seed.targetValue?.trim() || "";
    const normalizedValue = normalizeFollowTargetValue(targetValue);
    const key = `${seed.targetType}:${normalizedValue}`;

    if (!targetValue || !normalizedValue || seen.has(key)) {
      continue;
    }

    seen.add(key);
    targets.push({
      targetType: seed.targetType,
      targetValue,
      normalizedValue,
    });
  }

  return targets;
}

export async function ensureUserProfile(input: AuthUserProfileInput) {
  await ensureDatabase();
  const profile = buildUserProfileSeed(input);

  const user = await prisma.userProfile.upsert({
    where: { id: profile.id },
    update: {
      email: profile.email,
      displayName: profile.displayName,
    },
    create: profile,
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
    },
  });

  await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      ...DEFAULT_USER_PREFERENCES,
    },
  });

  return user;
}

export async function saveReleaseForUser(userId: string, releaseId: string) {
  await ensureDatabase();
  return prisma.userSavedRelease.upsert({
    where: {
      userId_releaseId: {
        userId,
        releaseId,
      },
    },
    update: {},
    create: {
      userId,
      releaseId,
    },
  });
}

export async function unsaveReleaseForUser(userId: string, releaseId: string) {
  await ensureDatabase();
  await prisma.userSavedRelease.deleteMany({
    where: {
      userId,
      releaseId,
    },
  });
}

export async function getReleaseUserActionState(input: {
  userId: string;
  releaseId: string;
  artistName?: string | null;
  labelName?: string | null;
}) {
  await ensureDatabase();
  const followTargets = buildReleaseFollowTargets(input);
  const [savedRelease, follows] = await Promise.all([
    prisma.userSavedRelease.findUnique({
      where: {
        userId_releaseId: {
          userId: input.userId,
          releaseId: input.releaseId,
        },
      },
      select: {
        releaseId: true,
      },
    }),
    followTargets.length > 0
      ? prisma.userFollow.findMany({
          where: {
            userId: input.userId,
            OR: followTargets.map((target) => ({
              targetType: target.targetType,
              normalizedValue: target.normalizedValue,
            })),
          },
          select: {
            targetType: true,
            normalizedValue: true,
          },
        })
      : Promise.resolve([]),
  ]);
  const followedKeys = new Set(
    follows.map((follow) => `${follow.targetType}:${follow.normalizedValue}`),
  );

  return {
    isSaved: Boolean(savedRelease),
    followTargets: followTargets.map((target) => ({
      ...target,
      isFollowing: followedKeys.has(`${target.targetType}:${target.normalizedValue}`),
    })),
  };
}

export async function followTargetForUser(
  userId: string,
  targetType: FollowTargetType,
  targetValue: string,
) {
  await ensureDatabase();
  const normalizedValue = normalizeFollowTargetValue(targetValue);
  if (!normalizedValue) {
    throw new Error("Follow target value is required.");
  }

  return prisma.userFollow.upsert({
    where: {
      userId_targetType_normalizedValue: {
        userId,
        targetType,
        normalizedValue,
      },
    },
    update: {
      targetValue: targetValue.trim(),
    },
    create: {
      userId,
      targetType,
      targetValue: targetValue.trim(),
      normalizedValue,
    },
  });
}

export async function unfollowTargetForUser(
  userId: string,
  targetType: FollowTargetType,
  targetValue: string,
) {
  await ensureDatabase();
  const normalizedValue = normalizeFollowTargetValue(targetValue);
  if (!normalizedValue) {
    return;
  }

  await prisma.userFollow.deleteMany({
    where: {
      userId,
      targetType,
      normalizedValue,
    },
  });
}
