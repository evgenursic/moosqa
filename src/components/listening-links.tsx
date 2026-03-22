import { getListeningLinks } from "@/lib/listening-links";
import { cn } from "@/lib/utils";

type ListeningLinksProps = {
  release: {
    title: string;
    artistName: string | null;
    projectTitle: string | null;
    sourceUrl: string;
    youtubeUrl?: string | null;
    youtubeMusicUrl?: string | null;
    bandcampUrl?: string | null;
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
            <span className="rounded-full border border-[#d8c788] bg-[#f7e8b5] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-[#3f3210]">
              Working now
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
    </div>
  );
}
