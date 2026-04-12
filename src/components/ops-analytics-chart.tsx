type DailyAnalyticsEntry = {
  dateKey: string;
  label: string;
  total: number;
  counts: {
    OPEN: number;
    LISTEN_CLICK: number;
    VOTE: number;
    SHARE: number;
    REACTION_POSITIVE: number;
    REACTION_NEGATIVE: number;
  };
};

type ChartMetricKey = "total" | "OPEN" | "LISTEN_CLICK" | "SHARE";

const chartMetrics: Array<{
  key: ChartMetricKey;
  label: string;
  barClassName: string;
}> = [
  {
    key: "total",
    label: "Total activity",
    barClassName: "bg-[var(--color-accent-strong)]/70",
  },
  {
    key: "OPEN",
    label: "Opens",
    barClassName: "bg-[#82a6ff]/78",
  },
  {
    key: "LISTEN_CLICK",
    label: "Listen clicks",
    barClassName: "bg-[#63bf93]/82",
  },
  {
    key: "SHARE",
    label: "Shares",
    barClassName: "bg-[#d48b6d]/78",
  },
];

export function OpsAnalyticsChart({ daily }: { daily: DailyAnalyticsEntry[] }) {
  if (daily.length === 0) {
    return null;
  }

  return (
    <section className="border-t border-[var(--color-line)] py-8">
      <div className="mb-6">
        <p className="section-kicker text-black/43">Daily analytics charts</p>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-black/62">
          Quick visual read of daily activity, opens, listening clicks, and shares over the recent window.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {chartMetrics.map((metric) => (
          <ChartPanel key={metric.key} metric={metric} daily={daily} />
        ))}
      </div>
    </section>
  );
}

function ChartPanel({
  metric,
  daily,
}: {
  metric: {
    key: ChartMetricKey;
    label: string;
    barClassName: string;
  };
  daily: DailyAnalyticsEntry[];
}) {
  const values = daily.map((entry) => getMetricValue(entry, metric.key));
  const maxValue = Math.max(...values, 1);

  return (
    <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      <div className="flex items-end justify-between gap-3">
        <p className="section-kicker text-black/43">{metric.label}</p>
        <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent-strong)]">
          Peak {maxValue}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2 md:grid-cols-14">
        {daily.map((entry) => {
          const value = getMetricValue(entry, metric.key);
          const barHeight = `${Math.max(10, Math.round((value / maxValue) * 100))}%`;

          return (
            <div key={`${metric.key}-${entry.dateKey}`} className="flex flex-col items-center gap-2">
              <div className="flex h-36 w-full items-end rounded-sm border border-[var(--color-line)] bg-[var(--color-paper)] px-1 py-1">
                <div
                  className={`w-full rounded-sm ${metric.barClassName}`}
                  style={{ height: barHeight }}
                  title={`${entry.label}: ${value}`}
                />
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-[0.14em] text-black/52">{entry.label}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink)]">{value}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getMetricValue(entry: DailyAnalyticsEntry, metric: ChartMetricKey) {
  if (metric === "total") {
    return entry.total;
  }

  return entry.counts[metric];
}
