"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { getPrefetchTarget, sanitizeInternalHref } from "@/components/release-link";

type BackToHomeButtonProps = {
  className?: string;
  label?: string;
};

export function BackToHomeButton({
  className,
  label = "Back to front page",
}: BackToHomeButtonProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fallbackHref = sanitizeInternalHref(searchParams.get("from"));
  const prefetchTarget = getPrefetchTarget(fallbackHref);

  useEffect(() => {
    router.prefetch(prefetchTarget);
  }, [prefetchTarget, router]);

  function handleNavigateHome() {
    if (fallbackHref) {
      router.push(fallbackHref);
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
