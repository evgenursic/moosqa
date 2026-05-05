import { type ReleaseType } from "@/generated/prisma/enums";
import { cn, formatReleaseTypeLabel } from "@/lib/utils";

type ReleaseTypeRibbonProps = {
  releaseType: ReleaseType;
  className?: string;
  compact?: boolean;
  tone?: "paper" | "dark";
};

export function ReleaseTypeRibbon({
  releaseType,
  className,
  compact = false,
  tone = "paper",
}: ReleaseTypeRibbonProps) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-2 border-l-4 font-semibold uppercase tracking-[0.2em] shadow-[0_12px_30px_rgba(29,34,48,0.12)]",
        compact ? "px-3 py-1.5 text-[10px]" : "px-4 py-2 text-[11px]",
        tone === "dark"
          ? "border-white bg-white text-[var(--color-ink)]"
          : "border-[var(--color-accent-strong)] bg-[var(--color-ink)] text-white",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          tone === "dark" ? "bg-[var(--color-accent-strong)]" : "bg-white/82",
        )}
      />
      {formatReleaseTypeLabel(releaseType)}
    </span>
  );
}
