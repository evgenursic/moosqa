import { computeTrendingScore } from "@/lib/trending-score";
import { formatWholeCount } from "@/lib/utils";

type ReleasePublicCountersProps = {
  publishedAt?: Date | string | null;
  analyticsUpdatedAt?: Date | string | null;
  youtubeViewCount?: number | null | undefined;
  openCount: number | null | undefined;
  listenClickCount: number | null | undefined;
  shareCount: number | null | undefined;
  positiveReactionCount: number | null | undefined;
  negativeReactionCount: number | null | undefined;
};

export function ReleasePublicCounters({
  publishedAt = new Date(),
  analyticsUpdatedAt = null,
  youtubeViewCount,
  openCount,
  listenClickCount,
  shareCount,
  positiveReactionCount,
  negativeReactionCount,
}: ReleasePublicCountersProps) {
  const safeOpenCount = sanitizeMetric(openCount);
  const safeListenClickCount = sanitizeMetric(listenClickCount);
  const safeShareCount = sanitizeMetric(shareCount);
  const safePositiveReactionCount = sanitizeMetric(positiveReactionCount);
  const safeNegativeReactionCount = sanitizeMetric(negativeReactionCount);
  const safeYouTubeViewCount = sanitizeMetric(youtubeViewCount);
  const trendScore = Math.round(
    computeTrendingScore({
      publishedAt,
      analyticsUpdatedAt,
      openCount: safeOpenCount,
      listenClickCount: safeListenClickCount,
      shareCount: safeShareCount,
      positiveReactionCount: safePositiveReactionCount,
      negativeReactionCount: safeNegativeReactionCount,
    }),
  );
  const audienceActions =
    safeOpenCount +
    safeListenClickCount +
    safeShareCount +
    safePositiveReactionCount +
    safeNegativeReactionCount;
  const items = [
    { label: "Trend score", value: trendScore },
    ...(safeYouTubeViewCount > 0 ? [{ label: "YouTube views", value: formatWholeCount(safeYouTubeViewCount) }] : []),
    { label: "Audience actions", value: audienceActions },
    { label: "Opens", value: safeOpenCount },
    { label: "Listen clicks", value: safeListenClickCount },
    { label: "Shares", value: safeShareCount },
    { label: "Likes", value: safePositiveReactionCount },
    { label: "Dislikes", value: safeNegativeReactionCount },
  ];

  return (
    <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
      <p className="section-kicker text-black/45">Audience signals</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        {items.map((item) => (
          <div key={item.label} className="border border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-3">
            <p className="section-kicker text-black/43">{item.label}</p>
            <p className="mt-2 text-2xl text-[var(--color-ink)] serif-display">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function sanitizeMetric(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}
