type PlatformDailyEntry = {
  dateKey: string;
  label: string;
  total: number;
  counts: {
    Bandcamp: number;
    YouTube: number;
    "YouTube Music": number;
  };
};

const platformConfig = [
  { key: "Bandcamp" as const, label: "Bandcamp", barClassName: "bg-[#63bf93]/85" },
  { key: "YouTube" as const, label: "YouTube", barClassName: "bg-[#d48b6d]/82" },
  { key: "YouTube Music" as const, label: "YouTube Music", barClassName: "bg-[#82a6ff]/82" },
];

export function OpsPlatformHistoryChart({ daily }: { daily: PlatformDailyEntry[] }) {
  if (daily.length === 0) {
    return null;
  }

  const maxValue = Math.max(
    1,
    ...daily.flatMap((entry) => platformConfig.map((platform) => entry.counts[platform.key])),
  );

  return (
    <section className="border-t border-[var(--color-line)] py-8">
      <div className="mb-6">
        <p className="section-kicker text-black/43">Platform trend history</p>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-black/62">
          Daily listening-click growth across Bandcamp, YouTube, and YouTube Music.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {platformConfig.map((platform) => (
          <div key={platform.key} className="border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
            <div className="flex items-end justify-between gap-3">
              <p className="section-kicker text-black/43">{platform.label}</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent-strong)]">
                Peak {Math.max(...daily.map((entry) => entry.counts[platform.key]), 0)}
              </p>
            </div>
            <div className="mt-4 grid grid-cols-7 gap-2 md:grid-cols-14">
              {daily.map((entry) => {
                const value = entry.counts[platform.key];
                const barHeight = `${Math.max(10, Math.round((value / maxValue) * 100))}%`;

                return (
                  <div key={`${platform.key}-${entry.dateKey}`} className="flex flex-col items-center gap-2">
                    <div className="flex h-32 w-full items-end rounded-sm border border-[var(--color-line)] bg-[var(--color-paper)] px-1 py-1">
                      <div
                        className={`w-full rounded-sm ${platform.barClassName}`}
                        style={{ height: barHeight }}
                        title={`${entry.label}: ${value}`}
                      />
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-black/52">{entry.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
