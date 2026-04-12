import { ReleaseBrief } from "@/components/release-brief";
import type { ReleaseListingItem } from "@/lib/release-sections";

type InsightRelease = ReleaseListingItem | null;

type AnalyticsInsightsStripProps = {
  mostOpenedToday: { release: InsightRelease; count: number } | null;
  mostSharedThisWeek: { release: InsightRelease; count: number } | null;
  mostClickedToListen: { release: InsightRelease; count: number } | null;
  platformHighlights?: Array<{
    platform: string;
    entry: { release: InsightRelease; count: number } | null;
  }>;
};

export function AnalyticsInsightsStrip({
  mostOpenedToday,
  mostSharedThisWeek,
  mostClickedToListen,
  platformHighlights = [],
}: AnalyticsInsightsStripProps) {
  const cards = [
    {
      title: "Most opened today",
      entry: mostOpenedToday,
      suffix: "opens",
    },
    {
      title: "Most shared this week",
      entry: mostSharedThisWeek,
      suffix: "shares",
    },
    {
      title: "Most clicked to listen",
      entry: mostClickedToListen,
      suffix: "listen clicks",
    },
  ];

  if (!cards.some((card) => card.entry?.release)) {
    return null;
  }

  return (
    <section id="audience-pulse" className="border-t border-[var(--color-line)] py-10">
      <div className="mb-6">
        <p className="section-kicker text-black/43">Audience pulse</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {cards.map((card) => {
          if (!card.entry?.release) {
            return null;
          }

          return (
            <div key={card.title} className="border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
              <p className="section-kicker text-black/43">{card.title}</p>
              <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent-strong)]">
                {card.entry.count} {card.suffix}
              </p>
              <div className="mt-4">
                <ReleaseBrief release={card.entry.release} fromHref="/#audience-pulse" />
              </div>
            </div>
          );
        })}
      </div>

      {platformHighlights.some((item) => item.entry?.release) ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {platformHighlights.map((item) => {
            if (!item.entry?.release) {
              return null;
            }

            return (
              <div key={item.platform} className="border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
                <p className="section-kicker text-black/43">{item.platform}</p>
                <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent-strong)]">
                  {item.entry.count} clicks this week
                </p>
                <div className="mt-4">
                  <ReleaseBrief release={item.entry.release} emphasis="listen" fromHref="/#audience-pulse" />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
