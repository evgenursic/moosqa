"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type BackToHomeButtonProps = {
  className?: string;
  label?: string;
};

export function BackToHomeButton({
  className,
  label = "Back to front page",
}: BackToHomeButtonProps) {
  const router = useRouter();

  useEffect(() => {
    router.prefetch("/");
  }, [router]);

  function handleNavigateHome() {
    router.push("/");
  }

  function prefetchHome() {
    router.prefetch("/");
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
