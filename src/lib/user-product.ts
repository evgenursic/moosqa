import { FollowTargetType } from "@/generated/prisma/enums";

import { ensureDatabase } from "@/lib/database";
import { buildVisibleReleaseWhere } from "@/lib/editorial";
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
  digestTimezone: "UTC",
  digestHourLocal: 9,
  preferredGenres: [] as string[],
};

const LEGACY_USER_PREFERENCE_FIELDS = {
  emailNotifications: DEFAULT_USER_PREFERENCES.emailNotifications,
  dailyDigest: DEFAULT_USER_PREFERENCES.dailyDigest,
  weeklyDigest: DEFAULT_USER_PREFERENCES.weeklyDigest,
  instantAlerts: DEFAULT_USER_PREFERENCES.instantAlerts,
  preferredGenres: DEFAULT_USER_PREFERENCES.preferredGenres,
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

export type PersonalRadarRelease = {
  id: string;
  slug: string;
  title: string;
  artistName: string | null;
  projectTitle: string | null;
  labelName: string | null;
  genreName: string | null;
  outletName: string | null;
  sourceUrl: string;
  publishedAt: Date;
  youtubeViewCount: number | null;
  score: number | null;
  commentCount: number | null;
  bandcampSupporterCount: number | null;
  bandcampFollowerCount: number | null;
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
  }).catch(async (error) => {
    if (!isNotificationPreferenceSchemaError(error)) {
      throw error;
    }

    await prisma.userPreference.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        ...LEGACY_USER_PREFERENCE_FIELDS,
      },
    });
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

export async function getPersonalRadarForUser(userId: string) {
  await ensureDatabase();
  const [savedReleases, follows] = await Promise.all([
    prisma.userSavedRelease.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        release: {
          select: personalRadarReleaseSelectWithVisibility,
        },
      },
    }),
    prisma.userFollow.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 24,
      select: {
        targetType: true,
        targetValue: true,
        normalizedValue: true,
        createdAt: true,
      },
    }),
  ]);
  const artistTargets = follows
    .filter((follow) => follow.targetType === FollowTargetType.ARTIST)
    .map((follow) => follow.targetValue);
  const labelTargets = follows
    .filter((follow) => follow.targetType === FollowTargetType.LABEL)
    .map((follow) => follow.targetValue);
  const followedReleases =
    artistTargets.length > 0 || labelTargets.length > 0
      ? await prisma.release.findMany({
          where: buildVisibleReleaseWhere({
            OR: [
              ...artistTargets.map((artistName) => ({ artistName })),
              ...labelTargets.map((labelName) => ({ labelName })),
            ],
          }),
          orderBy: { publishedAt: "desc" },
          take: 12,
          select: personalRadarReleaseSelect,
        })
      : [];

  return {
    savedReleases: savedReleases
      .map((entry) => entry.release)
      .filter((release) => !release.isHidden)
      .map((release) => {
        const { isHidden, ...visibleRelease } = release;
        void isHidden;
        return visibleRelease;
      }),
    followedReleases,
    follows,
  };
}

const personalRadarReleaseSelect = {
  id: true,
  slug: true,
  title: true,
  artistName: true,
  projectTitle: true,
  labelName: true,
  genreName: true,
  outletName: true,
  sourceUrl: true,
  publishedAt: true,
  youtubeViewCount: true,
  score: true,
  commentCount: true,
  bandcampSupporterCount: true,
  bandcampFollowerCount: true,
} satisfies Record<keyof PersonalRadarRelease, true>;

const personalRadarReleaseSelectWithVisibility = {
  ...personalRadarReleaseSelect,
  isHidden: true,
};

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

function isNotificationPreferenceSchemaError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("digestTimezone") ||
    error.message.includes("digestHourLocal") ||
    error.message.includes("The column") ||
    error.message.includes("does not exist")
  );
}
