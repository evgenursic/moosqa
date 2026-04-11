"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getPrefetchTarget, sanitizeInternalHref } from "@/components/release-link";

type MobileReleaseNavProps = {
  title: string;
};

export function MobileReleaseNav({ title }: MobileReleaseNavProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const fallbackHref = sanitizeInternalHref(searchParams.get("from"));
  const prefetchTarget = getPrefetchTarget(fallbackHref);

  useEffect(() => {
    router.prefetch(prefetchTarget);
  }, [prefetchTarget, router]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    lastScrollY.current = window.scrollY;

    function handleScroll() {
      if (window.innerWidth >= 1024 || ticking.current) {
        return;
      }

      ticking.current = true;
      window.requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - lastScrollY.current;

        if (currentY <= 32) {
          setVisible(false);
        } else if (delta < -5) {
          setVisible(true);
        } else if (delta > 8 && currentY > 72) {
          setVisible(false);
        }

        lastScrollY.current = currentY;
        ticking.current = false;
      });
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function handleBack() {
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

  return (
    <div
      className={`fixed inset-x-0 top-0 z-50 px-3 pt-3 transition-all duration-150 lg:hidden ${
        visible ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-4 opacity-0"
      }`}
    >
      <div className="flex items-center gap-3 border border-[var(--color-soft-line)] bg-[rgba(243,246,251,0.92)] px-3 py-2 shadow-[0_10px_28px_rgba(29,34,48,0.12)] backdrop-blur-md">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex h-10 w-10 items-center justify-center text-[var(--color-ink)]"
          aria-label="Go back"
        >
          <ArrowLeft size={18} strokeWidth={2.1} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-[var(--color-ink)] serif-display">{title}</p>
        </div>

        <Link
          href={fallbackHref || "/"}
          className="section-kicker inline-flex items-center text-[var(--color-accent-strong)]"
        >
          MooSQA
        </Link>
      </div>
    </div>
  );
}
