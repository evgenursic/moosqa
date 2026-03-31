import { ShoppingBag, Zap } from "lucide-react";

import { getListeningLinks, getPurchaseLink } from "@/lib/listening-links";
import { cn } from "@/lib/utils";

type ListeningLinksProps = {
  release: {
    title: string;
    artistName: string | null;
    projectTitle: string | null;
    releaseType: import("@/generated/prisma/enums").ReleaseType;
    sourceUrl: string;
    youtubeUrl?: string | null;
    youtubeMusicUrl?: string | null;
    bandcampUrl?: string | null;
    officialWebsiteUrl?: string | null;
    officialStoreUrl?: string | null;
  };
  compact?: boolean;
  dark?: boolean;
};

export function ListeningLinks({
  release,
  compact = false,
  dark = false,
}: ListeningLinksProps) {
  const links = getListeningLinks(release);
  const purchaseLink = getPurchaseLink(release);

  return (
    <div className={cn("flex flex-wrap gap-2.5", compact ? "mt-4" : "mt-5")}>
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] uppercase tracking-[0.18em] transition",
            dark
              ? "border-black/10 bg-black/5 text-[var(--color-ink)] hover:bg-black/10"
              : "border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-ink)] hover:border-[var(--color-ink)]",
            link.isDirect &&
              !dark &&
              "border-[var(--color-accent-strong)] bg-[var(--color-accent-strong)] text-white shadow-[0_10px_24px_rgba(53,78,122,0.18)] hover:opacity-92",
            link.isDirect &&
              dark &&
              "border-[var(--color-accent-strong)] bg-[var(--color-accent-strong)] text-white shadow-[0_10px_24px_rgba(53,78,122,0.18)] hover:opacity-92",
          )}
        >
          <span className={cn("font-medium", link.isDirect && "font-bold")}>
            {link.label}
          </span>
          {link.isDirect ? (
            <span
              aria-label="Direct link available"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#15803d] bg-[#22c55e] text-white shadow-[0_0_0_1px_rgba(21,128,61,0.14),0_8px_18px_rgba(34,197,94,0.24)]"
            >
              <Zap size={11} strokeWidth={2.6} />
              <span className="sr-only">Direct link available</span>
            </span>
          ) : (
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.18em]",
                dark ? "border-black/10 text-black/60" : "border-[var(--color-line)] text-black/55",
              )}
            >
              Search
            </span>
          )}
        </a>
      ))}
      {purchaseLink ? (
        <a
          href={purchaseLink.href}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] uppercase tracking-[0.18em] transition",
            dark
              ? "border-emerald-500/30 bg-emerald-500/10 text-[var(--color-ink)] hover:bg-emerald-500/14"
              : "border-emerald-600/30 bg-emerald-500/8 text-[var(--color-ink)] hover:border-emerald-600/50 hover:bg-emerald-500/12",
          )}
        >
          <ShoppingBag size={12} strokeWidth={2.2} className="shrink-0 text-emerald-700" />
          <span className="font-medium">{purchaseLink.label}</span>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.18em]",
              purchaseLink.isDirect
                ? "border-emerald-700/35 bg-emerald-600 text-white"
                : dark
                  ? "border-black/10 text-black/60"
                  : "border-[var(--color-line)] text-black/55",
            )}
          >
            {purchaseLink.isDirect ? "Store" : "Search"}
          </span>
        </a>
      ) : null}
    </div>
  );
}
