"use client";

import { type ReactNode, useMemo, useState } from "react";
import { Share2, ThumbsDown, ThumbsUp } from "lucide-react";

import { trackClientAnalyticsEvent } from "@/lib/client-analytics";
import { cn } from "@/lib/utils";

type ReactionValue = "positive" | "negative" | null;

type ReleaseCardActionsProps = {
  releaseId: string;
  slug: string;
  title: string;
  artistName: string | null;
  projectTitle: string | null;
};

export function ReleaseCardActions({
  releaseId,
  slug,
  title,
  artistName,
  projectTitle,
}: ReleaseCardActionsProps) {
  const [reaction, setReaction] = useState<ReactionValue>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const storedReaction = window.localStorage.getItem(getReactionStorageKey(releaseId));
    return storedReaction === "positive" || storedReaction === "negative" ? storedReaction : null;
  });
  const shareHref = useMemo(() => `/releases/${slug}`, [slug]);
  const displayLabel = artistName && projectTitle
    ? `${artistName} - ${projectTitle}`
    : artistName || projectTitle || title;

  function handleReaction(nextValue: Exclude<ReactionValue, null>) {
    const normalized = nextValue;
    setReaction(normalized);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(getReactionStorageKey(releaseId), normalized);
    }

    trackClientAnalyticsEvent({
      releaseId,
      action: nextValue === "negative" ? "REACTION_NEGATIVE" : "REACTION_POSITIVE",
      href: shareHref,
      metadata: {
        state: nextValue,
      },
    });
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

    if (currentNavigator?.share) {
      try {
        await currentNavigator.share({
          title: displayLabel,
          text: displayLabel,
          url: absoluteUrl,
        });
      } catch {
        // no-op, clipboard fallback below
      }
    } else if (currentNavigator?.clipboard) {
      try {
        await currentNavigator.clipboard.writeText(absoluteUrl);
      } catch {
        // no-op
      }
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
          label="Všeč mi je"
          onClick={() => handleReaction("positive")}
          roundedLeft
        />
        <span className="h-8 w-px bg-[var(--color-line)]" />
        <ActionButton
          active={reaction === "negative"}
          icon={<ThumbsDown size={15} strokeWidth={2} />}
          label="Ni mi všeč"
          onClick={() => handleReaction("negative")}
          roundedRight
        />
      </div>

      <button
        type="button"
        onClick={handleShare}
        className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-2 text-sm text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
      >
        <Share2 size={16} strokeWidth={2} />
        <span>Deli</span>
      </button>
    </div>
  );
}

function ActionButton({
  active,
  icon,
  label,
  onClick,
  roundedLeft = false,
  roundedRight = false,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  roundedLeft?: boolean;
  roundedRight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 text-sm text-[var(--color-ink)] transition",
        active
          ? "bg-[var(--color-accent-strong)] text-white"
          : "hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]",
        roundedLeft && "rounded-l-full",
        roundedRight && "rounded-r-full",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function getReactionStorageKey(releaseId: string) {
  return `moosqa:reaction:${releaseId}`;
}
