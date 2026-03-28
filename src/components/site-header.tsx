"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Menu, X } from "lucide-react";

import { AdvancedSearchButton, AdvancedSearchPanel } from "@/components/advanced-search";

type NavLink = {
  href: string;
  label: string;
  external?: boolean;
  sectionId?: string;
};

const leftLinks: NavLink[] = [
  { href: "/#latest", label: "Latest", sectionId: "latest" },
  { href: "/#top-rated", label: "Top rated", sectionId: "top-rated" },
  { href: "/#top-engaged", label: "Top engaged", sectionId: "top-engaged" },
  { href: "https://www.reddit.com/r/indieheads/", label: "Indieheads", external: true },
];

const rightLinks: NavLink[] = [
  { href: "/#albums", label: "Albums", sectionId: "albums" },
  { href: "/#eps", label: "EPs", sectionId: "eps" },
  { href: "/#live", label: "Live", sectionId: "live" },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const searchState = searchParams.get("search");
  const hasSearchCriteria = Boolean(
    searchParams.get("q") ||
      searchParams.get("type") ||
      searchParams.get("platform") ||
      searchParams.get("direct"),
  );
  const isSearchOpen =
    searchState === "open" || (searchState !== "closed" && hasSearchCriteria);
  const forceExpandedHeader = menuOpen || isSearchOpen;
  const showCompactHeader = isCompact && !forceExpandedHeader;

  useEffect(() => {
    if (!menuOpen) {
      document.body.style.removeProperty("overflow");
      return;
    }

    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.removeProperty("overflow");
    };
  }, [menuOpen]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    if (forceExpandedHeader) {
      lastScrollY.current = window.scrollY;
      return;
    }

    lastScrollY.current = window.scrollY;

    function updateHeaderState() {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;
      const isMobileViewport = window.innerWidth < 1024;
      const resetThreshold = isMobileViewport ? 12 : 32;
      const compactThreshold = isMobileViewport ? 26 : 140;
      const downDeltaThreshold = isMobileViewport ? 0 : 8;
      const upDeltaThreshold = isMobileViewport ? 0 : -8;

      if (currentY <= resetThreshold) {
        setIsCompact(false);
      } else if (delta > downDeltaThreshold && currentY > compactThreshold) {
        setIsCompact(true);
      } else if (delta < upDeltaThreshold) {
        setIsCompact(false);
      }

      lastScrollY.current = currentY;
      ticking.current = false;
    }

    function handleScroll() {
      if (ticking.current) {
        return;
      }

      ticking.current = true;
      window.requestAnimationFrame(updateHeaderState);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [forceExpandedHeader]);

  function handleSectionNavigation(link: NavLink) {
    if (!link.sectionId) {
      return;
    }

    setMenuOpen(false);

    if (pathname === "/") {
      const target = document.getElementById(link.sectionId);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.replaceState(null, "", `/#${link.sectionId}`);
        return;
      }
    }

    router.push(link.href, { scroll: true });
  }

  function renderNavLink(link: NavLink, className?: string) {
    if (link.external) {
      return (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          onClick={() => setMenuOpen(false)}
          className={className}
        >
          {link.label}
        </a>
      );
    }

    if (link.sectionId) {
      return (
        <button
          key={link.label}
          type="button"
          onClick={() => handleSectionNavigation(link)}
          className={className}
        >
          {link.label}
        </button>
      );
    }

    return (
      <Link
        key={link.label}
        href={link.href}
        prefetch={false}
        onClick={() => setMenuOpen(false)}
        className={className}
      >
        {link.label}
      </Link>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-40">
        <div
          className={`overflow-hidden transition-all duration-150 ease-out md:duration-300 ${
            showCompactHeader
              ? "max-h-0 -translate-y-5 opacity-0 pointer-events-none"
              : "max-h-[24rem] translate-y-0 opacity-100"
          }`}
        >
          <div className="border-b border-[var(--color-line)] bg-[var(--color-paper)]">
            <div className="border-b border-[var(--color-soft-line)] px-4 py-4 md:px-6 lg:px-8 lg:py-8">
              <div className="flex items-center justify-between gap-4 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-start lg:gap-8">
                <div className="flex items-center gap-3 lg:block">
                  <button
                    type="button"
                    onClick={() => setMenuOpen(true)}
                    aria-label="Open navigation menu"
                    className="inline-flex h-11 w-11 items-center justify-center text-[var(--color-ink)] transition hover:text-[var(--color-accent-strong)] lg:hidden"
                  >
                    <Menu size={20} strokeWidth={1.8} />
                  </button>

                  <nav className="hidden flex-wrap gap-x-8 gap-y-3 text-sm uppercase tracking-[0.18em] text-[var(--color-ink)] lg:flex">
                    {leftLinks.map((link) => renderNavLink(link, "header-nav-link"))}
                  </nav>
                </div>

                <div className="flex-1 text-center lg:flex-none">
                  <Link href="/" className="inline-block">
                    <p className="text-[2.9rem] leading-none text-[var(--color-ink)] serif-display sm:text-[3.5rem] md:text-6xl lg:text-7xl">
                      MooSQA
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.45em] text-black/56 md:mt-2 md:text-xs md:tracking-[0.65em]">
                      Music Radar
                    </p>
                  </Link>
                </div>

                <div className="flex items-center justify-end gap-2 lg:block">
                  <div className="hidden flex-wrap justify-end gap-x-8 gap-y-3 text-sm uppercase tracking-[0.18em] text-[var(--color-ink)] lg:flex">
                    {rightLinks.map((link) => renderNavLink(link, "header-nav-link"))}
                    <AdvancedSearchButton className="inline-flex items-center justify-center transition hover:opacity-70" />
                  </div>

                  <AdvancedSearchButton className="inline-flex h-11 w-11 items-center justify-center text-[var(--color-ink)] transition hover:text-[var(--color-accent-strong)] lg:hidden" />
                </div>
              </div>
            </div>

            <div className="px-4 pb-4 md:px-6 lg:px-8 lg:pb-6">
              <AdvancedSearchPanel />
            </div>
          </div>
        </div>

        <div
          className={`overflow-hidden transition-all duration-150 ease-out md:duration-300 ${
            showCompactHeader
              ? "max-h-20 translate-y-0 opacity-100"
              : "max-h-0 -translate-y-4 opacity-0 pointer-events-none"
          }`}
        >
          <div className="px-4 py-2 backdrop-blur-xl backdrop-saturate-150">
            <Link href="/" className="block text-center">
              <span className="glass-wordmark text-[1.9rem] leading-none text-[var(--color-ink)] serif-display md:text-[2.45rem]">
                MooSQA
              </span>
            </Link>
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 bg-black/45 lg:hidden" onClick={() => setMenuOpen(false)}>
          <div
            className="absolute inset-x-4 top-4 border border-[var(--color-line)] bg-[var(--color-paper)] p-5 shadow-[0_24px_60px_rgba(20,28,40,0.2)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-[var(--color-soft-line)] pb-4">
              <div>
                <p className="section-kicker text-black/44">Browse</p>
                <p className="mt-2 text-3xl leading-none text-[var(--color-ink)] serif-display">MooSQA</p>
              </div>

              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close navigation menu"
                className="inline-flex h-11 w-11 items-center justify-center border border-[var(--color-line)] bg-[var(--color-paper)] text-[var(--color-ink)]"
              >
                <X size={20} strokeWidth={1.8} />
              </button>
            </div>

            <nav className="mt-5 grid gap-2 text-sm uppercase tracking-[0.18em] text-[var(--color-ink)]">
              {[...leftLinks, ...rightLinks].map((link) =>
                renderNavLink(link, "border border-[var(--color-soft-line)] px-4 py-3 text-left"),
              )}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
