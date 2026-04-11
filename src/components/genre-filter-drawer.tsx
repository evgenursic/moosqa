"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";

type GenreFilterOption = {
  label: string;
  href: string;
};

type GenreFilterDrawerProps = {
  title: string;
  description?: string;
  selectedGenre: string;
  allHref: string;
  options: GenreFilterOption[];
  searchPlaceholder?: string;
  className?: string;
  compact?: boolean;
};

export function GenreFilterDrawer({
  title,
  description,
  selectedGenre,
  allHref,
  options,
  searchPlaceholder = "Filter genres",
  className,
  compact = false,
}: GenreFilterDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const filteredOptions = useMemo(() => {
    if (!deferredQuery) {
      return options;
    }

    return options.filter((option) => option.label.toLowerCase().includes(deferredQuery));
  }, [deferredQuery, options]);

  if (options.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="section-kicker text-black/43">{title}</p>
            {description ? (
              <p className="mt-2 text-sm leading-7 text-black/62">{description}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {selectedGenre ? (
              <Link
                href={allHref}
                scroll={false}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--color-accent-strong)] bg-[var(--color-accent-strong)]/10 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent-strong)] transition hover:bg-[var(--color-accent-strong)]/14"
              >
                <span>{selectedGenre}</span>
                <X size={12} strokeWidth={2} />
              </Link>
            ) : null}

            <button
              type="button"
              onClick={() => setIsOpen((current) => !current)}
              aria-expanded={isOpen}
              className="inline-flex min-h-11 items-center gap-3 rounded-full border border-[var(--color-ink)]/14 bg-[linear-gradient(135deg,rgba(50,88,164,0.1),rgba(112,132,196,0.04))] px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink)] shadow-[0_10px_28px_rgba(52,71,116,0.08)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
            >
              <SlidersHorizontal size={15} strokeWidth={1.9} />
              <span>{compact ? "Filter" : "Genre filter"}</span>
              <span className="rounded-full border border-[var(--color-ink)]/10 bg-white/72 px-2 py-1 text-[10px] text-black/55">
                {options.length}
              </span>
              <ChevronDown
                size={14}
                strokeWidth={1.9}
                className={`transition ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>
        </div>

        {isOpen ? (
          <div className="overflow-hidden border border-[var(--color-line)] bg-[linear-gradient(180deg,rgba(247,249,253,0.96),rgba(236,242,250,0.96))] px-4 py-4 shadow-[0_18px_40px_rgba(34,48,89,0.08)] backdrop-blur-sm md:px-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative max-w-xl flex-1">
                  <Search
                    size={15}
                    strokeWidth={1.9}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/38"
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={searchPlaceholder}
                    className="h-11 w-full border border-[var(--color-line)] bg-white/76 pl-10 pr-4 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent-strong)]"
                  />
                </div>

                <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-black/55">
                  <Link
                    href={allHref}
                    scroll={false}
                    className={
                      selectedGenre
                        ? "inline-flex items-center rounded-full border border-[var(--color-line)] px-3 py-2 transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
                        : "inline-flex items-center rounded-full border border-[var(--color-accent-strong)] bg-[var(--color-accent-strong)] px-3 py-2 text-white"
                    }
                  >
                    All genres
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setIsOpen(false);
                    }}
                    className="inline-flex items-center rounded-full border border-[var(--color-line)] px-3 py-2 transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="max-h-[24rem] overflow-y-auto pr-1">
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {filteredOptions.map((option) => (
                    <Link
                      key={option.label}
                      href={option.href}
                      scroll={false}
                      className={
                        selectedGenre === option.label
                          ? "inline-flex items-center rounded-full border border-[var(--color-accent-strong)] bg-[var(--color-accent-strong)] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-white"
                          : "inline-flex items-center rounded-full border border-[var(--color-line)] bg-white/72 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-black/58 transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
                      }
                    >
                      {option.label}
                    </Link>
                  ))}
                </div>

                {filteredOptions.length === 0 ? (
                  <div className="mt-4 border border-dashed border-[var(--color-line)] bg-white/62 px-4 py-5 text-sm text-black/58">
                    No genre matches that filter yet.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
