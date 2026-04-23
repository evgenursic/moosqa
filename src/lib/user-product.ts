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
