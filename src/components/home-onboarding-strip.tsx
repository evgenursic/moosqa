"use client";

import Link from "next/link";
import { useState } from "react";
import { Compass, Flame, Radio, Sparkles, X } from "lucide-react";

import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/browser-storage";

const ONBOARDING_DISMISS_KEY = "moosqa:onboarding:dismissed:v1";

const items = [
  { href: "/#latest", label: "Latest", icon: Sparkles },
  { href: "/#trending-now", label: "Trending", icon: Flame },
  { href: "/#albums", label: "Albums", icon: Compass },
  { href: "/#live", label: "Live", icon: Radio },
] as const;

export function HomeOnboardingStrip() {
  const [dismissed, setDismissed] = useState(() => safeLocalStorageGet(ONBOARDING_DISMISS_KEY) === "1");

  if (dismissed) {
    return null;
  }

  return (
    <section className="border-t border-[var(--color-line)] py-6">
      <div className="flex flex-col gap-4 border border-[var(--color-line)] bg-[var(--color-panel)] p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="section-kicker text-black/43">Start here</p>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-black/62">
            Jump straight into the newest feed, the strongest movers, full albums, or live sessions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className="inline-flex items-center gap-2 border border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
              >
                <Icon size={14} strokeWidth={1.9} />
                {item.label}
              </Link>
            );
          })}

          <button
            type="button"
            aria-label="Dismiss onboarding"
            title="Dismiss"
            onClick={() => {
              safeLocalStorageSet(ONBOARDING_DISMISS_KEY, "1");
              setDismissed(true);
            }}
            className="inline-flex items-center justify-center border border-[var(--color-line)] bg-[var(--color-paper)] p-3 text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
          >
            <X size={14} strokeWidth={1.9} />
          </button>
        </div>
      </div>
    </section>
  );
}
