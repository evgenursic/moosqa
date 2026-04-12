"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export function BackToTopFab() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setVisible(window.scrollY > 520);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "auto" })}
      aria-label="Back to top"
      title="Back to top"
      className="fixed bottom-5 right-5 z-[90] inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.88)] text-[var(--color-ink)] shadow-[0_16px_32px_rgba(21,28,40,0.18)] backdrop-blur-md transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)] md:bottom-7 md:right-7"
    >
      <ArrowUp size={18} strokeWidth={2} />
    </button>
  );
}
