type ReleasePublicCountersProps = {
  openCount: number;
  listenClickCount: number;
  shareCount: number;
  positiveReactionCount: number;
  negativeReactionCount: number;
};

export function ReleasePublicCounters({
  openCount,
  listenClickCount,
  shareCount,
  positiveReactionCount,
  negativeReactionCount,
}: ReleasePublicCountersProps) {
  const trendScore = Math.max(
    0,
    Math.round(
      openCount * 1.1 +
        listenClickCount * 1.7 +
        shareCount * 2.4 +
        positiveReactionCount * 1.9 -
        negativeReactionCount * 0.6,
    ),
  );
  const audienceActions =
    openCount +
    listenClickCount +
    shareCount +
    positiveReactionCount +
    negativeReactionCount;
  const items = [
    { label: "Trend score", value: trendScore },
    { label: "Audience actions", value: audienceActions },
    { label: "Opens", value: openCount },
    { label: "Listen clicks", value: listenClickCount },
    { label: "Shares", value: shareCount },
    { label: "Likes", value: positiveReactionCount },
    { label: "Dislikes", value: negativeReactionCount },
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
