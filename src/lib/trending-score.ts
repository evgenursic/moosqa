export function computeTrendingScore(release: {
  publishedAt: Date | string | null | undefined;
  analyticsUpdatedAt?: Date | string | null;
  openCount: number | null | undefined;
  listenClickCount: number | null | undefined;
  shareCount: number | null | undefined;
  positiveReactionCount: number | null | undefined;
  negativeReactionCount: number | null | undefined;
}) {
  const publishedAt = coerceDate(release.publishedAt) || new Date();
  const analyticsUpdatedAt = coerceDate(release.analyticsUpdatedAt);
  const ageHours = Math.max(1, (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60));
  const freshnessHours = analyticsUpdatedAt
    ? Math.max(1, (Date.now() - analyticsUpdatedAt.getTime()) / (1000 * 60 * 60))
    : ageHours;
  const interactionBase =
    coerceNumber(release.openCount) * 1.1 +
    coerceNumber(release.listenClickCount) * 1.7 +
    coerceNumber(release.shareCount) * 2.4 +
    coerceNumber(release.positiveReactionCount) * 1.9 -
    coerceNumber(release.negativeReactionCount) * 0.6;
  const freshnessBoost = 24 / Math.pow(freshnessHours + 2, 0.52);
  const recencyPenalty = 1 / Math.pow(ageHours + 4, 0.14);

  return Math.max(0, interactionBase * recencyPenalty + freshnessBoost);
}

function coerceDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function coerceNumber(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }

  return value;
}
