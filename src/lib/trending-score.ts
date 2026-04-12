export function computeTrendingScore(release: {
  publishedAt: Date;
  analyticsUpdatedAt?: Date | null;
  openCount: number;
  listenClickCount: number;
  shareCount: number;
  positiveReactionCount: number;
  negativeReactionCount: number;
}) {
  const ageHours = Math.max(1, (Date.now() - release.publishedAt.getTime()) / (1000 * 60 * 60));
  const freshnessHours = release.analyticsUpdatedAt
    ? Math.max(1, (Date.now() - release.analyticsUpdatedAt.getTime()) / (1000 * 60 * 60))
    : ageHours;
  const interactionBase =
    release.openCount * 1.1 +
    release.listenClickCount * 1.7 +
    release.shareCount * 2.4 +
    release.positiveReactionCount * 1.9 -
    release.negativeReactionCount * 0.6;
  const freshnessBoost = 24 / Math.pow(freshnessHours + 2, 0.52);
  const recencyPenalty = 1 / Math.pow(ageHours + 4, 0.14);

  return Math.max(0, interactionBase * recencyPenalty + freshnessBoost);
}
