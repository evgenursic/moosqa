"use client";

import { type ReactNode, useMemo, useState } from "react";
import { Share2, ThumbsDown, ThumbsUp } from "lucide-react";

import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/browser-storage";
import { postAnalyticsEventWithResponse, trackClientAnalyticsEvent } from "@/lib/client-analytics";
import { cn } from "@/lib/utils";

type ReactionValue = "positive" | "negative" | null;

type ReleaseCardActionsProps = {
  releaseId: string;
  slug: string;
  title: string;
  artistName: string | null;
  projectTitle: string | null;
  positiveReactionCount: number;
  negativeReactionCount: number;
};

export function ReleaseCardActions({
  releaseId,
  slug,
  title,
  artistName,
  projectTitle,
  positiveReactionCount,
  negativeReactionCount,
}: ReleaseCardActionsProps) {
  const [reaction, setReaction] = useState<ReactionValue>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const storedReaction = safeLocalStorageGet(getReactionStorageKey(releaseId));
    return storedReaction === "positive" || storedReaction === "negative" ? storedReaction : null;
  });
  const [counts, setCounts] = useState({
    positive: positiveReactionCount,
    negative: negativeReactionCount,
  });
  const shareHref = useMemo(() => `/releases/${slug}`, [slug]);
  const displayLabel = artistName && projectTitle
    ? `${artistName} - ${projectTitle}`
    : artistName || projectTitle || title;

  async function handleReaction(nextValue: Exclude<ReactionValue, null>) {
    if (reaction === nextValue) {
      return;
    }

    setCounts((current) => {
      const next = { ...current };
      if (reaction === "positive") {
        next.positive = Math.max(0, next.positive - 1);
      }
      if (reaction === "negative") {
        next.negative = Math.max(0, next.negative - 1);
      }
      if (nextValue === "positive") {
        next.positive += 1;
      }
      if (nextValue === "negative") {
        next.negative += 1;
      }
      return next;
    });
    setReaction(nextValue);
    safeLocalStorageSet(getReactionStorageKey(releaseId), nextValue);

    const result = await postAnalyticsEventWithResponse({
      releaseId,
      action: nextValue === "negative" ? "REACTION_NEGATIVE" : "REACTION_POSITIVE",
      href: shareHref,
      metadata: {
        state: nextValue,
      },
    });

    const releaseCounters = result?.releaseCounters;
    if (
      releaseCounters &&
      typeof releaseCounters.positiveReactionCount === "number" &&
      typeof releaseCounters.negativeReactionCount === "number"
    ) {
      setCounts({
        positive: releaseCounters.positiveReactionCount,
        negative: releaseCounters.negativeReactionCount,
      });
    }
  }

  async function handleShare() {
    const absoluteUrl = typeof window !== "undefined"
      ? new URL(shareHref, window.location.origin).toString()
      : shareHref;
    const currentNavigator =
      typeof window !== "undefined"
        ? (window.navigator as Navigator & {
            share?: (data: ShareData) => Promise<void>;
            clipboard?: Clipboard;
          })
        : null;

    let shared = false;
    if (currentNavigator?.share) {
      try {
        await currentNavigator.share({
          title: displayLabel,
          text: displayLabel,
          url: absoluteUrl,
        });
        shared = true;
      } catch {
        // ignore share aborts
      }
    } else if (currentNavigator?.clipboard) {
      try {
        await currentNavigator.clipboard.writeText(absoluteUrl);
        shared = true;
      } catch {
        // ignore clipboard failures
      }
    }

    if (!shared) {
      return;
    }

    trackClientAnalyticsEvent({
      releaseId,
      action: "SHARE",
      href: shareHref,
      metadata: {
        label: displayLabel,
      },
    });
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center overflow-hidden rounded-full border border-[var(--color-line)] bg-[var(--color-panel)]">
        <ActionButton
          active={reaction === "positive"}
          icon={<ThumbsUp size={15} strokeWidth={2} />}
          label="Like"
          count={counts.positive}
          onClick={() => handleReaction("positive")}
          roundedLeft
        />
        <span className="h-8 w-px bg-[var(--color-line)]" />
        <ActionButton
          active={reaction === "negative"}
          icon={<ThumbsDown size={15} strokeWidth={2} />}
          label="Dislike"
          count={counts.negative}
          onClick={() => handleReaction("negative")}
          roundedRight
        />
      </div>

      <button
        type="button"
        onClick={handleShare}
        title="Share"
        aria-label="Share"
        className="inline-flex items-center rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2 text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
      >
        <Share2 size={16} strokeWidth={2} />
      </button>
    </div>
  );
}

function ActionButton({
  active,
  icon,
  label,
  count,
  onClick,
  roundedLeft = false,
  roundedRight = false,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  count: number;
  onClick: () => void;
  roundedLeft?: boolean;
  roundedRight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-ink)] transition",
        active
          ? "bg-[var(--color-accent-strong)] text-white"
          : "hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]",
        roundedLeft && "rounded-l-full",
        roundedRight && "rounded-r-full",
      )}
    >
      {icon}
      <span className="min-w-[1.25rem] text-xs font-medium tabular-nums">{count}</span>
    </button>
  );
}

function getReactionStorageKey(releaseId: string) {
  return `moosqa:reaction:${releaseId}`;
}
