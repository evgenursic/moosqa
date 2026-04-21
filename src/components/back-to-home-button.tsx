"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { prepareAnchoredScrollRestore } from "@/lib/client-analytics";
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
    const targetHref = sanitizedFallbackHref || "/";
    if (targetHref.includes("#") && typeof window !== "undefined") {
      // Next 16 can duplicate hash fragments here, so restore against the path first and add the hash after mount.
      const navigationTarget = prepareAnchoredScrollRestore(targetHref);
      if (navigationTarget) {
        router.push(navigationTarget, { scroll: false });
        return;
      }

      window.location.assign(targetHref);
      return;
    }

    router.push(targetHref, { scroll: false });
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
