"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const SEARCH_PATHNAME = "/";
const SEARCH_KEYS = ["q", "type", "platform", "direct"] as const;

type AdvancedSearchButtonProps = {
  className?: string;
  onOpen: () => void;
};

type AdvancedSearchOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function AdvancedSearchButton({
  className,
  onOpen,
}: AdvancedSearchButtonProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open search"
      aria-expanded={false}
      aria-controls="advanced-search-overlay"
      className={`${className ?? ""} cursor-pointer`.trim()}
    >
      <Search size={18} strokeWidth={1.9} />
    </button>
  );
}

export function AdvancedSearchOverlay({
  isOpen,
  onClose,
}: AdvancedSearchOverlayProps) {
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get("q") || "";
  const currentType = searchParams.get("type") || "";
  const currentPlatform = searchParams.get("platform") || "";
  const currentDirect = searchParams.get("direct") === "1";
  const searchKey = `${currentQuery}|${currentType}|${currentPlatform}|${currentDirect ? "1" : "0"}`;

  if (!isOpen) {
    return null;
  }

  return (
    <AdvancedSearchDialog
      key={searchKey}
      onClose={onClose}
      initialQuery={currentQuery}
      initialType={currentType}
      initialPlatform={currentPlatform}
      initialDirect={currentDirect}
    />
  );
}

type AdvancedSearchDialogProps = {
  onClose: () => void;
  initialQuery: string;
  initialType: string;
  initialPlatform: string;
  initialDirect: boolean;
};

function AdvancedSearchDialog({
  onClose,
  initialQuery,
  initialType,
  initialPlatform,
  initialDirect,
}: AdvancedSearchDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchParamsString = useMemo(
    () => getSearchOnlyParams(searchParams.toString()).toString(),
    [searchParams],
  );
  const [queryValue, setQueryValue] = useState(initialQuery);
  const [typeValue, setTypeValue] = useState(initialType);
  const [platformValue, setPlatformValue] = useState(initialPlatform);
  const [directOnlyValue, setDirectOnlyValue] = useState(initialDirect);
  const [showFilters, setShowFilters] = useState(
    Boolean(initialType || initialPlatform || initialDirect),
  );

  const hasDraftCriteria = Boolean(
    queryValue.trim() || typeValue || platformValue || directOnlyValue,
  );

  useEffect(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextParams = getSearchOnlyParams(searchParamsString);
    setParam(nextParams, "q", queryValue.trim());
    setParam(nextParams, "type", typeValue);
    setParam(nextParams, "platform", platformValue);
    setParam(nextParams, "direct", directOnlyValue ? "1" : "");

    const href = nextParams.toString() ? `${SEARCH_PATHNAME}?${nextParams}` : SEARCH_PATHNAME;
    if (pathname === SEARCH_PATHNAME) {
      router.replace(href, { scroll: false });
    } else {
      router.push(href);
    }

    onClose();
    requestAnimationFrame(() => {
      document.getElementById("explore")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function clearSearch() {
    setQueryValue("");
    setTypeValue("");
    setPlatformValue("");
    setDirectOnlyValue(false);
    setShowFilters(false);

    if (pathname === SEARCH_PATHNAME && searchParamsString) {
      router.replace(SEARCH_PATHNAME, { scroll: false });
    }

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }

  return (
    <div
      id="advanced-search-overlay"
      className="fixed inset-0 z-[260] bg-[rgba(13,18,28,0.97)] text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Advanced search"
    >
      <div className="mx-auto flex min-h-screen max-w-[1480px] flex-col px-4 py-5 md:px-8 md:py-7">
        <form onSubmit={submit} className="flex-1">
          <div className="flex items-center gap-4 border-b border-white/12 pb-5 md:gap-5 md:pb-7">
            <Search
              size={22}
              strokeWidth={1.9}
              className="shrink-0 text-white/68"
            />

            <input
              ref={inputRef}
              id="advanced-query"
              name="q"
              type="search"
              inputMode="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
              value={queryValue}
              onChange={(event) => setQueryValue(event.target.value)}
              placeholder="Search artists, tracks, albums, EPs, live sessions"
              className="editorial-search-input flex-1 bg-transparent text-2xl font-bold tracking-[-0.021em] text-white placeholder:text-white/30 focus:outline-none md:text-3xl"
            />

            <button
              type="button"
              onClick={onClose}
              aria-label="Close search"
              className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white/78 transition hover:bg-white/8 hover:text-white"
            >
              <X size={20} strokeWidth={1.9} />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 py-4 text-[11px] uppercase tracking-[0.2em] text-white/54 md:py-5">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                {hasDraftCriteria ? "Ready to search" : "Search the full MooSQA archive"}
              </span>
              {queryValue.trim() ? <span>Query: {queryValue.trim()}</span> : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFilters((current) => !current)}
                className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-white/12 px-4 py-2 transition hover:border-white/24 hover:bg-white/6 hover:text-white"
              >
                <SlidersHorizontal size={14} strokeWidth={1.8} />
                {showFilters ? "Hide filters" : "Filters"}
              </button>

              {hasDraftCriteria ? (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-white/12 px-4 py-2 transition hover:border-white/24 hover:bg-white/6 hover:text-white"
                >
                  Clear
                </button>
              ) : null}

              <button
                type="submit"
                className="group inline-flex min-h-10 cursor-pointer items-center gap-3 rounded-full bg-white px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-black transition hover:bg-[var(--color-sun)]"
              >
                <span>Search</span>
                <ArrowRight
                  size={16}
                  strokeWidth={1.9}
                  className="transition-transform group-hover:translate-x-1"
                />
              </button>
            </div>
          </div>

          {showFilters ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(12rem,0.72fr)_minmax(12rem,0.72fr)_auto]">
              <div>
                <label
                  htmlFor="advanced-type"
                  className="mb-2 block text-[11px] uppercase tracking-[0.18em] text-white/46"
                >
                  Release type
                </label>
                <select
                  id="advanced-type"
                  name="type"
                  value={typeValue}
                  onChange={(event) => setTypeValue(event.target.value)}
                  className="w-full rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-sm text-white outline-none transition focus:border-white/28"
                >
                  <option value="" className="bg-[#0f1521]">
                    All release types
                  </option>
                  <option value="SINGLE" className="bg-[#0f1521]">
                    Singles
                  </option>
                  <option value="ALBUM" className="bg-[#0f1521]">
                    Albums
                  </option>
                  <option value="EP" className="bg-[#0f1521]">
                    EPs
                  </option>
                  <option value="PERFORMANCE" className="bg-[#0f1521]">
                    Live / Session
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="advanced-platform"
                  className="mb-2 block text-[11px] uppercase tracking-[0.18em] text-white/46"
                >
                  Platform
                </label>
                <select
                  id="advanced-platform"
                  name="platform"
                  value={platformValue}
                  onChange={(event) => setPlatformValue(event.target.value)}
                  className="w-full rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-sm text-white outline-none transition focus:border-white/28"
                >
                  <option value="" className="bg-[#0f1521]">
                    Any platform
                  </option>
                  <option value="youtube" className="bg-[#0f1521]">
                    YouTube
                  </option>
                  <option value="youtube-music" className="bg-[#0f1521]">
                    YouTube Music
                  </option>
                  <option value="bandcamp" className="bg-[#0f1521]">
                    Bandcamp
                  </option>
                  <option value="spotify" className="bg-[#0f1521]">
                    Spotify
                  </option>
                  <option value="apple-music" className="bg-[#0f1521]">
                    Apple Music
                  </option>
                </select>
              </div>

              <div className="flex items-end md:col-span-2 xl:col-span-1">
                <label className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-sm text-white/90">
                  <input
                    type="checkbox"
                    name="direct"
                    checked={directOnlyValue}
                    onChange={(event) => setDirectOnlyValue(event.target.checked)}
                    className="h-4 w-4 accent-white"
                  />
                  Working links only
                </label>
              </div>
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 md:mt-8 md:grid-cols-2 xl:grid-cols-3">
            <div className="border border-white/8 bg-white/[0.03] p-4">
              <p className="section-kicker text-white/36">Fast search</p>
              <p className="mt-3 text-sm leading-7 text-white/64">
                This panel now opens locally in the browser first, so tapping the search icon no
                longer waits for a server refresh before showing the input.
              </p>
            </div>

            <div className="border border-white/8 bg-white/[0.03] p-4">
              <p className="section-kicker text-white/36">Archive coverage</p>
              <p className="mt-3 text-sm leading-7 text-white/64">
                Search spans artists, release titles, genres, labels, summaries, outlets and live
                sessions from the current MooSQA archive.
              </p>
            </div>

            <div className="border border-white/8 bg-white/[0.03] p-4">
              <p className="section-kicker text-white/36">Quick submit</p>
              <p className="mt-3 text-sm leading-7 text-white/64">
                Press Enter to load matching results below the header on the homepage.
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function setParam(params: URLSearchParams, key: string, value: string) {
  if (value) {
    params.set(key, value);
    return;
  }

  params.delete(key);
}

function getSearchOnlyParams(searchParamsString: string) {
  const sourceParams = new URLSearchParams(searchParamsString);
  const nextParams = new URLSearchParams();

  for (const key of SEARCH_KEYS) {
    const value = sourceParams.get(key);
    if (value) {
      nextParams.set(key, value);
    }
  }

  return nextParams;
}
