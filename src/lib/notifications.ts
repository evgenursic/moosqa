import { createHash } from "node:crypto";

import {
  FollowTargetType,
  NotificationChannel,
  NotificationDeliveryOutcome,
  NotificationJobStatus,
  NotificationJobType,
  ReleaseType,
} from "@/generated/prisma/enums";
import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site";
import { getDisplaySummary } from "@/lib/utils";

const DEFAULT_DIGEST_TIMEZONE = "UTC";
const DEFAULT_DIGEST_HOUR_LOCAL = 9;
const DAILY_DIGEST_LOOKBACK_HOURS = 36;
const WEEKLY_DIGEST_LOOKBACK_DAYS = 8;
const DAILY_DIGEST_MAX_ITEMS = 8;
const WEEKLY_DIGEST_MAX_ITEMS = 12;
const PROCESS_NOTIFICATION_LIMIT = 20;
const ALLOWED_DIGEST_RELEASE_TYPES = [
  ReleaseType.SINGLE,
  ReleaseType.ALBUM,
  ReleaseType.EP,
  ReleaseType.PERFORMANCE,
  ReleaseType.LIVE_SESSION,
] as const;

export type NotificationPreferenceState = {
  emailNotifications: boolean;
  dailyDigest: boolean;
  weeklyDigest: boolean;
  instantAlerts: boolean;
  digestTimezone: string;
  digestHourLocal: number;
  notificationEmail: string | null;
  transportReady: boolean;
};

type NotificationPreferenceInput = {
  emailNotifications: boolean;
  dailyDigest: boolean;
  weeklyDigest: boolean;
  instantAlerts: boolean;
  digestTimezone: string;
  digestHourLocal: number;
};

type DigestScheduleContext = {
  periodKey: string;
  lookbackStart: Date;
  lookbackEnd: Date;
};

type DigestSignalSnapshot = {
  followedArtists: string[];
  followedLabels: string[];
  savedGenres: string[];
};

type DigestCandidate = {
  id: string;
  slug: string;
  title: string;
  artistName: string | null;
  projectTitle: string | null;
  labelName: string | null;
  genreName: string | null;
  releaseType: ReleaseType;
  publishedAt: Date;
  qualityScore: number;
  aiSummary: string | null;
  summary: string | null;
};

type RankedDigestItem = {
  id: string;
  slug: string;
  title: string;
  artistName: string | null;
  projectTitle: string | null;
  labelName: string | null;
  genreName: string | null;
  releaseType: ReleaseType;
  publishedAt: string;
  summary: string;
  matchReasons: string[];
  score: number;
};

type NotificationJobPayload = {
  type: NotificationJobType;
  periodKey: string;
  generatedAt: string;
  items: RankedDigestItem[];
};

type NotificationJobDraft = {
  userId: string;
  type: NotificationJobType;
  channel: NotificationChannel;
  periodKey: string;
  destination: string | null;
  status: NotificationJobStatus;
  subject: string | null;
  payloadJson: string | null;
  itemCount: number;
  message: string | null;
};

type NotificationProcessSummary = {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferenceInput = {
  emailNotifications: false,
  dailyDigest: false,
  weeklyDigest: true,
  instantAlerts: false,
  digestTimezone: DEFAULT_DIGEST_TIMEZONE,
  digestHourLocal: DEFAULT_DIGEST_HOUR_LOCAL,
};

export function isValidDigestTimezone(value: string | null | undefined) {
  if (!value?.trim()) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value.trim() }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeDigestTimezone(value: string | null | undefined) {
  const normalized = value?.trim() || DEFAULT_DIGEST_TIMEZONE;
  return isValidDigestTimezone(normalized) ? normalized : DEFAULT_DIGEST_TIMEZONE;
}

export function normalizeDigestHourLocal(value: number | string | null | undefined) {
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseInt(typeof value === "string" ? value : "", 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_DIGEST_HOUR_LOCAL;
  }

  return Math.min(23, Math.max(0, Math.floor(parsed)));
}

export function buildNotificationPreferencePatch(input: {
  emailNotifications?: boolean;
  dailyDigest?: boolean;
  weeklyDigest?: boolean;
  instantAlerts?: boolean;
  digestTimezone?: string | null;
  digestHourLocal?: number | string | null;
}) {
  return {
    emailNotifications: Boolean(input.emailNotifications),
    dailyDigest: Boolean(input.dailyDigest),
    weeklyDigest: Boolean(input.weeklyDigest),
    instantAlerts: Boolean(input.instantAlerts),
    digestTimezone: normalizeDigestTimezone(input.digestTimezone),
    digestHourLocal: normalizeDigestHourLocal(input.digestHourLocal),
  };
}

export async function getNotificationPreferenceState(userId: string): Promise<NotificationPreferenceState> {
  await ensureDatabase();
  const user = await prisma.userProfile.findUnique({
    where: { id: userId },
    select: {
      email: true,
      preferences: {
        select: {
          emailNotifications: true,
          dailyDigest: true,
          weeklyDigest: true,
          instantAlerts: true,
          digestTimezone: true,
          digestHourLocal: true,
        },
      },
    },
  });
  const preferences = user?.preferences;

  return {
    emailNotifications:
      preferences?.emailNotifications ?? DEFAULT_NOTIFICATION_PREFERENCES.emailNotifications,
    dailyDigest: preferences?.dailyDigest ?? DEFAULT_NOTIFICATION_PREFERENCES.dailyDigest,
    weeklyDigest: preferences?.weeklyDigest ?? DEFAULT_NOTIFICATION_PREFERENCES.weeklyDigest,
    instantAlerts: preferences?.instantAlerts ?? DEFAULT_NOTIFICATION_PREFERENCES.instantAlerts,
    digestTimezone: preferences?.digestTimezone ?? DEFAULT_NOTIFICATION_PREFERENCES.digestTimezone,
    digestHourLocal:
      preferences?.digestHourLocal ?? DEFAULT_NOTIFICATION_PREFERENCES.digestHourLocal,
    notificationEmail: user?.email || null,
    transportReady: isNotificationEmailTransportReady(),
  };
}

export async function updateUserNotificationPreferences(
  userId: string,
  input: NotificationPreferenceInput,
) {
  await ensureDatabase();

  return prisma.userPreference.upsert({
    where: { userId },
    update: input,
    create: {
      userId,
      ...input,
    },
    select: {
      emailNotifications: true,
      dailyDigest: true,
      weeklyDigest: true,
      instantAlerts: true,
      digestTimezone: true,
      digestHourLocal: true,
      updatedAt: true,
    },
  });
}

export async function runNotificationDigestCycle(options?: {
  now?: Date;
  limit?: number;
  mode?: "daily" | "weekly" | "all";
  phase?: "enqueue" | "send" | "all";
}) {
  const now = options?.now || new Date();
  const phase = options?.phase || "all";
  const mode = options?.mode || "all";

  const enqueueSummary =
    phase === "send"
      ? { evaluated: 0, queued: 0, skipped: 0, existing: 0 }
      : await enqueueDueNotificationJobs({ now, mode });
  const processSummary =
    phase === "enqueue"
      ? { processed: 0, sent: 0, failed: 0, skipped: 0 }
      : await processNotificationQueue({
          now,
          limit: options?.limit,
          mode,
        });

  return {
    ok: true,
    mode,
    phase,
    ...enqueueSummary,
    ...processSummary,
  };
}

export async function enqueueDueNotificationJobs(options?: {
  now?: Date;
  mode?: "daily" | "weekly" | "all";
}) {
  await ensureDatabase();
  const now = options?.now || new Date();
  const mode = options?.mode || "all";
  const preferences = await prisma.userPreference.findMany({
    where: {
      emailNotifications: true,
      OR: [
        ...(mode !== "weekly" ? [{ dailyDigest: true }] : []),
        ...(mode !== "daily" ? [{ weeklyDigest: true }] : []),
      ],
    },
    select: {
      userId: true,
      emailNotifications: true,
      dailyDigest: true,
      weeklyDigest: true,
      instantAlerts: true,
      digestTimezone: true,
      digestHourLocal: true,
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  const summary = {
    evaluated: 0,
    queued: 0,
    skipped: 0,
    existing: 0,
  };

  for (const preference of preferences) {
    const drafts = await buildDueJobDrafts(
      {
        userId: preference.userId,
        emailNotifications: preference.emailNotifications,
        dailyDigest: preference.dailyDigest,
        weeklyDigest: preference.weeklyDigest,
        instantAlerts: preference.instantAlerts,
        digestTimezone: preference.digestTimezone,
        digestHourLocal: preference.digestHourLocal,
        notificationEmail: preference.user.email || null,
      },
      now,
      mode,
    );

    for (const draft of drafts) {
      summary.evaluated += 1;
      const existing = await prisma.notificationJob.findUnique({
        where: {
          userId_type_channel_periodKey: {
            userId: draft.userId,
            type: draft.type,
            channel: draft.channel,
            periodKey: draft.periodKey,
          },
        },
        select: {
          id: true,
        },
      });

      if (existing) {
        summary.existing += 1;
        continue;
      }

      await prisma.notificationJob.create({
        data: draft,
      });

      if (draft.status === NotificationJobStatus.PENDING) {
        summary.queued += 1;
      } else {
        summary.skipped += 1;
      }
    }
  }

  return summary;
}

export async function processNotificationQueue(options?: {
  now?: Date;
  limit?: number;
  mode?: "daily" | "weekly" | "all";
}) {
  await ensureDatabase();
  const now = options?.now || new Date();
  const limit = Math.min(
    PROCESS_NOTIFICATION_LIMIT,
    Math.max(1, options?.limit || PROCESS_NOTIFICATION_LIMIT),
  );
  const where =
    options?.mode === "daily"
      ? { type: NotificationJobType.DAILY_DIGEST }
      : options?.mode === "weekly"
        ? { type: NotificationJobType.WEEKLY_DIGEST }
        : undefined;
  const jobs = await prisma.notificationJob.findMany({
    where: {
      status: {
        in: [NotificationJobStatus.PENDING, NotificationJobStatus.FAILED],
      },
      ...(where || {}),
    },
    orderBy: [{ queuedAt: "asc" }],
    take: limit,
    select: {
      id: true,
      userId: true,
      type: true,
      channel: true,
      destination: true,
      subject: true,
      payloadJson: true,
      attemptCount: true,
      periodKey: true,
    },
  });

  const summary: NotificationProcessSummary = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  for (const job of jobs) {
    const attemptNumber = job.attemptCount + 1;
    const claimed = await prisma.notificationJob.updateMany({
      where: {
        id: job.id,
        status: {
          in: [NotificationJobStatus.PENDING, NotificationJobStatus.FAILED],
        },
      },
      data: {
        status: NotificationJobStatus.PROCESSING,
        lastAttemptAt: now,
        attemptCount: {
          increment: 1,
        },
      },
    });

    if (claimed.count === 0) {
      continue;
    }

    summary.processed += 1;

    if (job.channel !== NotificationChannel.EMAIL) {
      await markNotificationJobSkipped(job.id, {
        userId: job.userId,
        type: job.type,
        channel: job.channel,
        destination: job.destination,
        attemptNumber,
        message: "Unsupported notification channel.",
      });
      summary.skipped += 1;
      continue;
    }

    if (!job.destination?.trim()) {
      await markNotificationJobSkipped(job.id, {
        userId: job.userId,
        type: job.type,
        channel: job.channel,
        destination: job.destination,
        attemptNumber,
        message: "Notification destination is missing.",
      });
      summary.skipped += 1;
      continue;
    }

    if (!job.subject || !job.payloadJson) {
      await markNotificationJobSkipped(job.id, {
        userId: job.userId,
        type: job.type,
        channel: job.channel,
        destination: job.destination,
        attemptNumber,
        message: "Notification payload is missing.",
      });
      summary.skipped += 1;
      continue;
    }

    const payload = parseNotificationPayload(job.payloadJson);
    if (!payload || payload.items.length === 0) {
      await markNotificationJobSkipped(job.id, {
        userId: job.userId,
        type: job.type,
        channel: job.channel,
        destination: job.destination,
        attemptNumber,
        message: "Notification payload has no digest items.",
      });
      summary.skipped += 1;
      continue;
    }

    const transport = getNotificationEmailTransport();
    if (!transport) {
      await markNotificationJobSkipped(job.id, {
        userId: job.userId,
        type: job.type,
        channel: job.channel,
        destination: job.destination,
        attemptNumber,
        message: "Email transport is not configured.",
      });
      summary.skipped += 1;
      continue;
    }

    const result = await sendDigestEmail({
      apiKey: transport.apiKey,
      from: transport.from,
      to: job.destination,
      subject: job.subject,
      payload,
      idempotencyKey: createHash("sha256")
        .update(`notification:${job.id}:${job.periodKey}`)
        .digest("hex"),
    });

    if (result.ok) {
      await prisma.notificationJob.update({
        where: { id: job.id },
        data: {
          status: NotificationJobStatus.SENT,
          deliveredAt: now,
          processedAt: now,
          providerMessageId: result.providerMessageId,
          message: "Delivered",
        },
      });
      await logNotificationDeliveryAttempt({
        jobId: job.id,
        userId: job.userId,
        type: job.type,
        channel: job.channel,
        outcome: NotificationDeliveryOutcome.SENT,
        destination: job.destination,
        attemptNumber,
        responseStatus: result.responseStatus,
        latencyMs: result.latencyMs,
        message: "Delivered",
        providerMessageId: result.providerMessageId,
      });
      summary.sent += 1;
    } else {
      await prisma.notificationJob.update({
        where: { id: job.id },
        data: {
          status: NotificationJobStatus.FAILED,
          processedAt: now,
          message: result.message,
        },
      });
      await logNotificationDeliveryAttempt({
        jobId: job.id,
        userId: job.userId,
        type: job.type,
        channel: job.channel,
        outcome: NotificationDeliveryOutcome.FAILED,
        destination: job.destination,
        attemptNumber,
        responseStatus: result.responseStatus,
        latencyMs: result.latencyMs,
        message: result.message,
        providerMessageId: result.providerMessageId,
      });
      summary.failed += 1;
    }
  }

  return summary;
}

export async function getNotificationOpsSnapshot() {
  await ensureDatabase();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [preferenceCounts, jobCounts, recentJobs, recentDeliveries] = await Promise.all([
    prisma.userPreference.aggregate({
      _count: {
        _all: true,
      },
      where: {},
    }),
    prisma.notificationJob.groupBy({
      by: ["status"],
      _count: {
        _all: true,
      },
      where: {
        queuedAt: {
          gte: cutoff,
        },
      },
    }),
    prisma.notificationJob.findMany({
      orderBy: [{ queuedAt: "desc" }],
      take: 16,
      select: {
        id: true,
        userId: true,
        type: true,
        channel: true,
        periodKey: true,
        status: true,
        destination: true,
        itemCount: true,
        attemptCount: true,
        queuedAt: true,
        processedAt: true,
        message: true,
      },
    }),
    prisma.notificationDeliveryLog.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 16,
      select: {
        id: true,
        jobId: true,
        userId: true,
        type: true,
        channel: true,
        outcome: true,
        destination: true,
        attemptNumber: true,
        responseStatus: true,
        latencyMs: true,
        message: true,
        createdAt: true,
      },
    }),
  ]);
  const adoptionCounts = await prisma.userPreference.groupBy({
    by: ["emailNotifications", "dailyDigest", "weeklyDigest", "instantAlerts"],
    _count: {
      _all: true,
    },
  });

  return {
    preferenceTotals: {
      all: preferenceCounts._count._all,
      emailEnabled: countAdoption(adoptionCounts, "emailNotifications"),
      dailyEnabled: countAdoption(adoptionCounts, "dailyDigest"),
      weeklyEnabled: countAdoption(adoptionCounts, "weeklyDigest"),
      instantEnabled: countAdoption(adoptionCounts, "instantAlerts"),
    },
    jobTotals: {
      pending: readJobCount(jobCounts, NotificationJobStatus.PENDING),
      processing: readJobCount(jobCounts, NotificationJobStatus.PROCESSING),
      sent: readJobCount(jobCounts, NotificationJobStatus.SENT),
      failed: readJobCount(jobCounts, NotificationJobStatus.FAILED),
      skipped: readJobCount(jobCounts, NotificationJobStatus.SKIPPED),
    },
    recentJobs,
    recentDeliveries,
  };
}

export function getDigestScheduleContext(
  type: NotificationJobType,
  digestTimezone: string,
  digestHourLocal: number,
  now = new Date(),
): DigestScheduleContext | null {
  const timeZone = normalizeDigestTimezone(digestTimezone);
  const localHour = normalizeDigestHourLocal(digestHourLocal);
  const parts = getTimeZoneParts(now, timeZone);

  if (parts.hour !== localHour) {
    return null;
  }

  if (type === NotificationJobType.DAILY_DIGEST) {
    return {
      periodKey: `daily:${parts.year}-${parts.month}-${parts.day}`,
      lookbackStart: new Date(now.getTime() - DAILY_DIGEST_LOOKBACK_HOURS * 60 * 60 * 1000),
      lookbackEnd: now,
    };
  }

  if (type === NotificationJobType.WEEKLY_DIGEST && parts.weekday === "Mon") {
    return {
      periodKey: `weekly:${parts.year}-${parts.month}-${parts.day}`,
      lookbackStart: new Date(now.getTime() - WEEKLY_DIGEST_LOOKBACK_DAYS * 24 * 60 * 60 * 1000),
      lookbackEnd: now,
    };
  }

  return null;
}

export function selectDigestItems(input: {
  candidates: DigestCandidate[];
  signals: DigestSignalSnapshot;
  type: NotificationJobType;
}) {
  const ranked = input.candidates
    .map((candidate) => {
      const matchReasons = buildMatchReasons(candidate, input.signals);
      if (matchReasons.length === 0) {
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
        releaseType: candidate.releaseType,
        publishedAt: candidate.publishedAt.toISOString(),
        summary: getDisplaySummary({
          aiSummary: candidate.aiSummary,
          summary: candidate.summary,
          artistName: candidate.artistName,
          projectTitle: candidate.projectTitle,
          title: candidate.title,
          releaseType: candidate.releaseType,
          genreName: candidate.genreName,
        }),
        matchReasons,
        score: scoreDigestCandidate(candidate, matchReasons),
      } satisfies RankedDigestItem;
    })
    .filter((item): item is RankedDigestItem => Boolean(item))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (right.publishedAt !== left.publishedAt) {
        return right.publishedAt.localeCompare(left.publishedAt);
      }

      return left.slug.localeCompare(right.slug);
    });

  const maxItems =
    input.type === NotificationJobType.DAILY_DIGEST
      ? DAILY_DIGEST_MAX_ITEMS
      : WEEKLY_DIGEST_MAX_ITEMS;

  return ranked.slice(0, maxItems);
}

export function isNotificationEmailTransportReady() {
  return Boolean(getNotificationEmailTransport());
}

function getNotificationEmailTransport() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.ALERT_EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    return null;
  }

  return { apiKey, from };
}

async function buildDueJobDrafts(
  preference: Omit<NotificationPreferenceState, "transportReady"> & { userId: string },
  now: Date,
  mode: "daily" | "weekly" | "all",
) {
  const drafts: NotificationJobDraft[] = [];
  const digestTypes = [
    ...(mode !== "weekly" ? [NotificationJobType.DAILY_DIGEST] : []),
    ...(mode !== "daily" ? [NotificationJobType.WEEKLY_DIGEST] : []),
  ];

  for (const digestType of digestTypes) {
    const isEnabled =
      digestType === NotificationJobType.DAILY_DIGEST
        ? preference.dailyDigest
        : preference.weeklyDigest;
    if (!preference.emailNotifications || !isEnabled) {
      continue;
    }

    const schedule = getDigestScheduleContext(
      digestType,
      preference.digestTimezone,
      preference.digestHourLocal,
      now,
    );
    if (!schedule) {
      continue;
    }

    drafts.push(
      await buildNotificationJobDraft({
        userId: preference.userId,
        type: digestType,
        schedule,
        destination: preference.notificationEmail,
      }),
    );
  }

  return drafts;
}

async function buildNotificationJobDraft(input: {
  userId: string;
  type: NotificationJobType;
  schedule: DigestScheduleContext;
  destination: string | null;
}) {
  const signals = await getDigestSignalSnapshot(input.userId);
  if (!input.destination?.trim()) {
    return {
      userId: input.userId,
      type: input.type,
      channel: NotificationChannel.EMAIL,
      periodKey: input.schedule.periodKey,
      destination: input.destination,
      status: NotificationJobStatus.SKIPPED,
      subject: null,
      payloadJson: null,
      itemCount: 0,
      message: "User email is missing for notifications.",
    } satisfies NotificationJobDraft;
  }

  if (
    signals.followedArtists.length === 0 &&
    signals.followedLabels.length === 0 &&
    signals.savedGenres.length === 0
  ) {
    return {
      userId: input.userId,
      type: input.type,
      channel: NotificationChannel.EMAIL,
      periodKey: input.schedule.periodKey,
      destination: input.destination,
      status: NotificationJobStatus.SKIPPED,
      subject: null,
      payloadJson: null,
      itemCount: 0,
      message: "No follows or saved genres are configured for notifications.",
    } satisfies NotificationJobDraft;
  }

  const candidates = await prisma.release.findMany({
    where: {
      releaseType: {
        in: [...ALLOWED_DIGEST_RELEASE_TYPES],
      },
      publishedAt: {
        gte: input.schedule.lookbackStart,
        lte: input.schedule.lookbackEnd,
      },
      OR: [
        ...signals.followedArtists.map((artistName) => ({ artistName })),
        ...signals.followedLabels.map((labelName) => ({ labelName })),
        ...signals.savedGenres.map((genreName) => ({ genreName })),
      ],
    },
    orderBy: [{ publishedAt: "desc" }, { qualityScore: "desc" }],
    take: 60,
    select: {
      id: true,
      slug: true,
      title: true,
      artistName: true,
      projectTitle: true,
      labelName: true,
      genreName: true,
      releaseType: true,
      publishedAt: true,
      qualityScore: true,
      aiSummary: true,
      summary: true,
    },
  });
  const items = selectDigestItems({
    candidates,
    signals,
    type: input.type,
  });

  if (items.length === 0) {
    return {
      userId: input.userId,
      type: input.type,
      channel: NotificationChannel.EMAIL,
      periodKey: input.schedule.periodKey,
      destination: input.destination,
      status: NotificationJobStatus.SKIPPED,
      subject: null,
      payloadJson: null,
      itemCount: 0,
      message: "No digest items matched the current send window.",
    } satisfies NotificationJobDraft;
  }

  const payload: NotificationJobPayload = {
    type: input.type,
    periodKey: input.schedule.periodKey,
    generatedAt: input.schedule.lookbackEnd.toISOString(),
    items,
  };

  return {
    userId: input.userId,
    type: input.type,
    channel: NotificationChannel.EMAIL,
    periodKey: input.schedule.periodKey,
    destination: input.destination,
    status: NotificationJobStatus.PENDING,
    subject: buildDigestSubject(input.type, items.length),
    payloadJson: JSON.stringify(payload),
    itemCount: items.length,
    message: null,
  } satisfies NotificationJobDraft;
}

async function getDigestSignalSnapshot(userId: string): Promise<DigestSignalSnapshot> {
  const [follows, savedGenres] = await Promise.all([
    prisma.userFollow.findMany({
      where: {
        userId,
      },
      select: {
        targetType: true,
        targetValue: true,
      },
    }),
    prisma.userSavedRelease.findMany({
      where: {
        userId,
        release: {
          genreName: {
            not: null,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 24,
      select: {
        release: {
          select: {
            genreName: true,
          },
        },
      },
    }),
  ]);

  return {
    followedArtists: follows
      .filter((follow) => follow.targetType === FollowTargetType.ARTIST)
      .map((follow) => follow.targetValue),
    followedLabels: follows
      .filter((follow) => follow.targetType === FollowTargetType.LABEL)
      .map((follow) => follow.targetValue),
    savedGenres: [...new Set(savedGenres.map((entry) => entry.release.genreName).filter(isNonEmptyString))],
  };
}

function buildMatchReasons(candidate: DigestCandidate, signals: DigestSignalSnapshot) {
  const reasons: string[] = [];

  if (candidate.artistName && signals.followedArtists.includes(candidate.artistName)) {
    reasons.push("followed artist");
  }
  if (candidate.labelName && signals.followedLabels.includes(candidate.labelName)) {
    reasons.push("followed label");
  }
  if (candidate.genreName && signals.savedGenres.includes(candidate.genreName)) {
    reasons.push("saved genre");
  }

  return reasons;
}

function scoreDigestCandidate(candidate: DigestCandidate, matchReasons: string[]) {
  return (
    (matchReasons.includes("followed artist") ? 400 : 0) +
    (matchReasons.includes("followed label") ? 280 : 0) +
    (matchReasons.includes("saved genre") ? 90 : 0) +
    Math.max(0, Math.min(candidate.qualityScore, 100))
  );
}

async function sendDigestEmail(input: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  payload: NotificationJobPayload;
  idempotencyKey: string;
}) {
  const siteUrl = getSiteUrl();
  const html = buildDigestEmailHtml(input.payload, siteUrl);
  const text = buildDigestEmailText(input.payload, siteUrl);

  try {
    const startedAt = Date.now();
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        from: input.from,
        to: [input.to],
        subject: input.subject,
        html,
        text,
      }),
      cache: "no-store",
    });
    const responsePayload = await safeReadJson(response);

    if (!response.ok) {
      return {
        ok: false as const,
        responseStatus: response.status,
        latencyMs: Date.now() - startedAt,
        message: `HTTP ${response.status}`,
        providerMessageId: readProviderMessageId(responsePayload),
      };
    }

    return {
      ok: true as const,
      responseStatus: response.status,
      latencyMs: Date.now() - startedAt,
      message: "Delivered",
      providerMessageId: readProviderMessageId(responsePayload),
    };
  } catch {
    return {
      ok: false as const,
      responseStatus: null,
      latencyMs: 0,
      message: "Network error",
      providerMessageId: null,
    };
  }
}

async function markNotificationJobSkipped(
  jobId: string,
  input: {
    userId: string;
    type: NotificationJobType;
    channel: NotificationChannel;
    destination: string | null;
    attemptNumber: number;
    message: string;
  },
) {
  await prisma.notificationJob.update({
    where: { id: jobId },
    data: {
      status: NotificationJobStatus.SKIPPED,
      processedAt: new Date(),
      message: input.message,
    },
  });

  await logNotificationDeliveryAttempt({
    jobId,
    userId: input.userId,
    type: input.type,
    channel: input.channel,
    outcome: NotificationDeliveryOutcome.SKIPPED,
    destination: input.destination,
    attemptNumber: input.attemptNumber,
    responseStatus: null,
    latencyMs: null,
    message: input.message,
    providerMessageId: null,
  });
}

async function logNotificationDeliveryAttempt(input: {
  jobId: string | null;
  userId: string | null;
  type: NotificationJobType | null;
  channel: NotificationChannel;
  outcome: NotificationDeliveryOutcome;
  destination: string | null;
  attemptNumber: number;
  responseStatus: number | null;
  latencyMs: number | null;
  message: string | null;
  providerMessageId: string | null;
}) {
  await prisma.notificationDeliveryLog.create({
    data: {
      jobId: input.jobId,
      userId: input.userId,
      type: input.type,
      channel: input.channel,
      outcome: input.outcome,
      destination: input.destination,
      attemptNumber: input.attemptNumber,
      responseStatus: input.responseStatus,
      latencyMs: input.latencyMs,
      message: input.message,
      providerMessageId: input.providerMessageId,
    },
  });
}

function buildDigestSubject(type: NotificationJobType, itemCount: number) {
  const prefix =
    type === NotificationJobType.DAILY_DIGEST ? "Daily MooSQA digest" : "Weekly MooSQA digest";
  return `${prefix}: ${itemCount} fresh match${itemCount === 1 ? "" : "es"}`;
}

function buildDigestEmailHtml(payload: NotificationJobPayload, siteUrl: string) {
  const title =
    payload.type === NotificationJobType.DAILY_DIGEST
      ? "Daily MooSQA digest"
      : "Weekly MooSQA digest";
  const accountUrl = `${siteUrl}/account?next=%2Fradar`;
  const radarUrl = `${siteUrl}/radar`;

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.55; color: #182131;">
      <h2 style="margin:0 0 10px;">${escapeHtml(title)}</h2>
      <p style="margin:0 0 18px; color:#4c5669;">
        Fresh releases picked from the artists, labels, and genres shaping your MooSQA radar.
      </p>
      ${payload.items
        .map((item) => {
          const releaseUrl = `${siteUrl}/releases/${item.slug}?from=%2Fradar`;
          const heading = item.artistName && item.projectTitle
            ? `${item.artistName} - ${item.projectTitle}`
            : item.artistName || item.projectTitle || item.title;
          const meta = [
            item.genreName,
            item.labelName,
            item.matchReasons.join(", "),
          ].filter(isNonEmptyString);

          return `
            <div style="border:1px solid #d8deea; padding:14px 16px; margin:0 0 14px;">
              <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.14em; color:#6b7386;">
                ${escapeHtml(meta.join(" / "))}
              </div>
              <div style="font-size:22px; margin-top:8px; line-height:1.15;">
                <a href="${escapeHtml(releaseUrl)}" style="color:#182131; text-decoration:none;">
                  ${escapeHtml(heading)}
                </a>
              </div>
              ${item.artistName && item.projectTitle ? `<div style="margin-top:6px; color:#4c5669;">${escapeHtml(item.title)}</div>` : ""}
              <div style="margin-top:10px; color:#354055;">${escapeHtml(item.summary)}</div>
            </div>
          `;
        })
        .join("")}
      <div style="margin-top:20px;">
        <a href="${escapeHtml(radarUrl)}" style="display:inline-block; padding:12px 16px; background:#526eaa; color:#fff; text-decoration:none; margin-right:8px;">Open radar</a>
        <a href="${escapeHtml(accountUrl)}" style="display:inline-block; padding:12px 16px; border:1px solid #c6d3ec; color:#182131; text-decoration:none;">Manage notifications</a>
      </div>
    </div>
  `;
}

function buildDigestEmailText(payload: NotificationJobPayload, siteUrl: string) {
  const title =
    payload.type === NotificationJobType.DAILY_DIGEST
      ? "Daily MooSQA digest"
      : "Weekly MooSQA digest";

  return [
    title,
    "",
    ...payload.items.flatMap((item) => {
      const heading = item.artistName && item.projectTitle
        ? `${item.artistName} - ${item.projectTitle}`
        : item.artistName || item.projectTitle || item.title;
      return [
        heading,
        item.title,
        [item.genreName, item.labelName, item.matchReasons.join(", ")].filter(isNonEmptyString).join(" / "),
        item.summary,
        `${siteUrl}/releases/${item.slug}?from=%2Fradar`,
        "",
      ];
    }),
    `Radar: ${siteUrl}/radar`,
    `Manage notifications: ${siteUrl}/account?next=%2Fradar`,
  ].join("\n");
}

function readJobCount(
  rows: Array<{ status: NotificationJobStatus; _count: { _all: number } }>,
  status: NotificationJobStatus,
) {
  return rows.find((row) => row.status === status)?._count._all || 0;
}

function countAdoption(
  rows: Array<{
    emailNotifications: boolean;
    dailyDigest: boolean;
    weeklyDigest: boolean;
    instantAlerts: boolean;
    _count: { _all: number };
  }>,
  key: "emailNotifications" | "dailyDigest" | "weeklyDigest" | "instantAlerts",
) {
  return rows
    .filter((row) => row[key])
    .reduce((total, row) => total + row._count._all, 0);
}

function getTimeZoneParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);

  return {
    weekday: readDatePart(parts, "weekday"),
    year: readDatePart(parts, "year"),
    month: readDatePart(parts, "month"),
    day: readDatePart(parts, "day"),
    hour: Number.parseInt(readDatePart(parts, "hour"), 10),
  };
}

function readDatePart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPart["type"],
) {
  return parts.find((part) => part.type === type)?.value || "";
}

function parseNotificationPayload(value: string): NotificationJobPayload | null {
  try {
    const parsed = JSON.parse(value) as NotificationJobPayload;
    return Array.isArray(parsed.items) ? parsed : null;
  } catch {
    return null;
  }
}

async function safeReadJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function readProviderMessageId(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  return typeof record.id === "string" ? record.id : null;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}
