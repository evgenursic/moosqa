"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { AdvancedSearchButton, AdvancedSearchPanel } from "@/components/advanced-search";

type NavLink = {
  href: string;
  label: string;
  external?: boolean;
};

const leftLinks: NavLink[] = [
  { href: "#latest", label: "Latest" },
  { href: "#top-rated", label: "Top rated" },
  { href: "#top-engaged", label: "Top engaged" },
  { href: "https://www.reddit.com/r/indieheads/", label: "Indieheads", external: true },
];

const rightLinks: NavLink[] = [
  { href: "#albums", label: "Albums" },
  { href: "#eps", label: "EPs" },
  { href: "#performances", label: "Live" },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

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

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[var(--color-paper)] backdrop-blur">
        <div className="border-b border-[var(--color-soft-line)] px-4 py-4 md:px-6 lg:px-8 lg:py-8">
          <div className="flex items-center justify-between gap-4 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-start lg:gap-8">
            <div className="flex items-center gap-3 lg:block">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Open navigation menu"
                className="inline-flex h-11 w-11 items-center justify-center border border-[var(--color-line)] bg-[var(--color-paper)] text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)] lg:hidden"
              >
                <Menu size={20} strokeWidth={1.8} />
              </button>

              <nav className="hidden flex-wrap gap-x-8 gap-y-3 text-sm uppercase tracking-[0.18em] text-[var(--color-ink)] lg:flex">
                {leftLinks.map((link) =>
                  link.external ? (
                    <a key={link.label} href={link.href} target="_blank" rel="noreferrer">
                      {link.label}
                    </a>
                  ) : (
                    <a key={link.label} href={link.href}>
                      {link.label}
                    </a>
                  ),
                )}
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
                {rightLinks.map((link) => (
                  <a key={link.label} href={link.href}>
                    {link.label}
                  </a>
                ))}
                <AdvancedSearchButton className="inline-flex items-center justify-center transition hover:opacity-70" />
              </div>

              <AdvancedSearchButton className="inline-flex h-11 w-11 items-center justify-center border border-[var(--color-line)] bg-[var(--color-paper)] text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)] lg:hidden" />
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 md:px-6 lg:px-8 lg:pb-6">
          <AdvancedSearchPanel />
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
                link.external ? (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setMenuOpen(false)}
                    className="border border-[var(--color-soft-line)] px-4 py-3"
                  >
                    {link.label}
                  </a>
                ) : (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="border border-[var(--color-soft-line)] px-4 py-3"
                  >
                    {link.label}
                  </a>
                ),
              )}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
