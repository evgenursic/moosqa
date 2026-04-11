"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";

type ShareFilterLinkProps = {
  href: string;
  label: string;
};

export function ShareFilterLink({ href, label }: ShareFilterLinkProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      const absoluteUrl = new URL(href, window.location.origin).toString();
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-2 border border-[var(--color-line)] px-3 py-2 transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
      aria-label={`Copy share link for ${label}`}
    >
      {copied ? <Check size={13} strokeWidth={2} /> : <Link2 size={13} strokeWidth={1.9} />}
      <span>{copied ? "Copied" : "Share filter"}</span>
    </button>
  );
}
