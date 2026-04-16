type AlertLatencyDailyEntry = {
  dateKey: string;
  label: string;
  latencies: {
    discord: number;
    slack: number;
    email: number;
  };
};

const channelConfig = [
  { key: "discord" as const, label: "Discord", barClassName: "bg-[#82a6ff]/85" },
  { key: "slack" as const, label: "Slack", barClassName: "bg-[#63bf93]/85" },
  { key: "email" as const, label: "Email", barClassName: "bg-[#d48b6d]/85" },
];

export function OpsAlertLatencyChart({ daily }: { daily: AlertLatencyDailyEntry[] }) {
  if (daily.length === 0) {
    return null;
  }

  const maxValue = Math.max(
    1,
    ...daily.flatMap((entry) => channelConfig.map((channel) => entry.latencies[channel.key])),
  );

  return (
    <section className="border-t border-[var(--color-line)] py-8">
      <div className="mb-6">
        <p className="section-kicker text-black/43">Alert latency history</p>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-black/62">
          Daily average delivery time across Discord, Slack, and email alert channels.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {channelConfig.map((channel) => (
          <div key={channel.key} className="border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
            <div className="flex items-end justify-between gap-3">
              <p className="section-kicker text-black/43">{channel.label}</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent-strong)]">
                Peak {Math.max(...daily.map((entry) => entry.latencies[channel.key]), 0)} ms
              </p>
            </div>
            <div className="mt-4 grid grid-cols-7 gap-2 md:grid-cols-14">
              {daily.map((entry) => {
                const value = entry.latencies[channel.key];
                const barHeight = value > 0 ? `${Math.max(10, Math.round((value / maxValue) * 100))}%` : "8%";

                return (
                  <div key={`${channel.key}-${entry.dateKey}`} className="flex flex-col items-center gap-2">
                    <div className="flex h-32 w-full items-end rounded-sm border border-[var(--color-line)] bg-[var(--color-paper)] px-1 py-1">
                      <div
                        className={`w-full rounded-sm ${channel.barClassName}`}
                        style={{ height: barHeight, opacity: value > 0 ? 1 : 0.24 }}
                        title={`${entry.label}: ${value} ms`}
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
