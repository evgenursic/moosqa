"use client";

import { useState } from "react";

type AlertChannel = "all" | "discord" | "slack" | "email";

type AlertTestState = {
  pending: boolean;
  message: string | null;
};

const channels: Array<{ value: AlertChannel; label: string }> = [
  { value: "all", label: "Test all" },
  { value: "discord", label: "Test Discord" },
  { value: "slack", label: "Test Slack" },
  { value: "email", label: "Test email" },
];

export function OpsAlertTestControls({ secret }: { secret: string }) {
  const [state, setState] = useState<AlertTestState>({
    pending: false,
    message: null,
  });

  async function handleRun(channel: AlertChannel) {
    setState({
      pending: true,
      message: `Running ${channel} delivery test...`,
    });

    try {
      const response = await fetch(
        `/api/debug/alert-test?secret=${encodeURIComponent(secret)}&channel=${encodeURIComponent(channel)}`,
        {
          method: "POST",
        },
      );
      const payload = (await response.json()) as {
        ok?: boolean;
        results?: Array<{
          channel: string;
          configured: boolean;
          delivered: boolean;
        }>;
        error?: string;
      };

      if (!response.ok) {
        setState({
          pending: false,
          message: payload.error || "Alert delivery test failed.",
        });
        return;
      }

      const parts =
        payload.results?.map((entry) =>
          `${entry.channel}: ${entry.configured ? (entry.delivered ? "delivered" : "failed") : "not configured"}`
        ) || [];

      setState({
        pending: false,
        message: parts.length > 0 ? parts.join(" / ") : "No delivery channels responded.",
      });
    } catch {
      setState({
        pending: false,
        message: "Alert delivery test failed.",
      });
    }
  }

  return (
    <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      <p className="section-kicker text-black/43">Alert delivery test</p>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-black/62">
        Fire a private production-style alert to Discord, Slack, email, or every configured channel.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {channels.map((channel) => (
          <button
            key={channel.value}
            type="button"
            disabled={state.pending}
            onClick={() => handleRun(channel.value)}
            className="inline-flex items-center border border-[var(--color-line)] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {channel.label}
          </button>
        ))}
      </div>
      {state.message ? (
        <p className="mt-4 text-xs uppercase tracking-[0.14em] text-black/55">{state.message}</p>
      ) : null}
    </div>
  );
}
