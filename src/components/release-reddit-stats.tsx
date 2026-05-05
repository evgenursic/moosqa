import { cn, formatCompactWholeCount } from "@/lib/utils";

type ReleaseRedditStatsProps = {
  upvotes?: number | string | null;
  comments?: number | string | null;
  className?: string;
  compact?: boolean;
  tone?: "paper" | "dark";
};

export function ReleaseRedditStats({
  upvotes,
  comments,
  className,
  compact = false,
  tone = "paper",
}: ReleaseRedditStatsProps) {
  const upvoteValue = coerceStat(upvotes);
  const commentValue = coerceStat(comments);
  const upvoteLabel = formatCompactWholeCount(upvoteValue) ?? "Syncing";
  const commentLabel = formatCompactWholeCount(commentValue) ?? "Syncing";
  const stats = [
    { label: "Upvotes", value: upvoteLabel, aria: buildAriaLabel(upvoteLabel, "upvotes") },
    { label: "Comments", value: commentLabel, aria: buildAriaLabel(commentLabel, "comments") },
  ];

  return (
    <div
      aria-label={stats.map((stat) => stat.aria).join(", ")}
      className={cn(
        "grid w-fit max-w-full grid-cols-2 gap-1.5",
        stats.length === 1 ? "grid-cols-1" : null,
        className,
      )}
    >
      {stats.map((stat) => (
        <span
          key={stat.label}
          className={cn(
            "inline-flex min-w-0 flex-col border font-semibold uppercase shadow-[0_10px_24px_rgba(29,34,48,0.08)]",
            compact ? "px-2.5 py-1.5" : "px-3 py-2",
            tone === "dark"
              ? "border-white/14 bg-white/[0.055] text-white"
              : "border-[var(--color-soft-line)] bg-[var(--color-panel)] text-[var(--color-ink)]",
          )}
        >
          <span className={cn("leading-none", compact ? "text-sm" : "text-base")}>{stat.value}</span>
          <span
            className={cn(
              "mt-1 truncate tracking-[0.16em]",
              compact ? "text-[8px]" : "text-[9px]",
              tone === "dark" ? "text-white/52" : "text-black/48",
            )}
          >
            {stat.label}
          </span>
        </span>
      ))}
    </div>
  );
}

function buildAriaLabel(value: string, label: "upvotes" | "comments") {
  if (value === "Syncing") {
    return `Reddit ${label} are syncing`;
  }

  return `${value} Reddit ${label}`;
}

function coerceStat(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}
