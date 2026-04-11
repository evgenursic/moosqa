"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { rememberScrollPosition, trackClientAnalyticsEvent } from "@/lib/client-analytics";

type ReleaseLinkProps = {
  releaseId?: string;
  slug: string;
  fromHref?: string | null;
  className?: string;
  children: ReactNode;
  scroll?: boolean;
  prefetch?: boolean;
  onClick?: () => void;
};

export function ReleaseLink({
  releaseId,
  slug,
  fromHref,
  className,
  children,
  scroll = true,
  prefetch = true,
  onClick,
}: ReleaseLinkProps) {
  const router = useRouter();
  const href = buildReleaseHref(slug, fromHref);

  function handlePrefetch() {
    if (!prefetch) {
      return;
    }

    router.prefetch(href);
  }

  function handleClick() {
    rememberScrollPosition(fromHref || undefined);

    if (releaseId) {
      trackClientAnalyticsEvent({
        releaseId,
        action: "OPEN",
        href,
        sourcePath: fromHref || undefined,
      });
    }

    onClick?.();
  }

  return (
    <Link
      href={href}
      prefetch={prefetch}
      scroll={scroll}
      onPointerEnter={handlePrefetch}
      onFocus={handlePrefetch}
      onTouchStart={handlePrefetch}
      onClick={handleClick}
      className={className}
    >
      {children}
    </Link>
  );
}

export function buildReleaseHref(slug: string, fromHref?: string | null) {
  const params = new URLSearchParams();

  if (fromHref) {
    const sanitizedFromHref = sanitizeInternalHref(fromHref);
    if (sanitizedFromHref) {
      params.set("from", sanitizedFromHref);
    }
  }

  const query = params.toString();
  return query ? `/releases/${slug}?${query}` : `/releases/${slug}`;
}

export function sanitizeInternalHref(value: string | null | undefined) {
  const normalized = value?.trim() || "";
  if (!normalized || !normalized.startsWith("/")) {
    return null;
  }

  return normalized;
}

export function getPrefetchTarget(value: string | null | undefined) {
  const href = sanitizeInternalHref(value);
  if (!href) {
    return "/";
  }

  const [pathWithQuery] = href.split("#");
  return pathWithQuery || "/";
}
