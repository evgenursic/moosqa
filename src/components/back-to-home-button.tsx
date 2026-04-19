"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { getPrefetchTarget, sanitizeInternalHref } from "@/lib/navigation";

type BackToHomeButtonProps = {
  className?: string;
  label?: string;
  fallbackHref?: string | null;
};

export function BackToHomeButton({
  className,
  label = "Back to front page",
  fallbackHref = null,
}: BackToHomeButtonProps) {
  const router = useRouter();
  const sanitizedFallbackHref = sanitizeInternalHref(fallbackHref);
  const prefetchTarget = getPrefetchTarget(sanitizedFallbackHref);

  useEffect(() => {
    router.prefetch(prefetchTarget);
  }, [prefetchTarget, router]);

  function handleNavigateHome() {
    if (sanitizedFallbackHref) {
      router.push(sanitizedFallbackHref);
      return;
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  }

  function prefetchHome() {
    router.prefetch(prefetchTarget);
  }

  return (
    <button
      type="button"
      onClick={handleNavigateHome}
      onPointerEnter={prefetchHome}
      onFocus={prefetchHome}
      className={className}
    >
      {label}
    </button>
  );
}
