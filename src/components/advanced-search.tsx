"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type AdvancedSearchButtonProps = {
  className?: string;
};

export function AdvancedSearchButton({ className }: AdvancedSearchButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasCriteria = Boolean(
    searchParams.get("q") ||
      searchParams.get("type") ||
      searchParams.get("platform") ||
      searchParams.get("direct"),
  );
  const searchState = searchParams.get("search");
  const isOpen = searchState === "open" || (searchState !== "closed" && hasCriteria);

  function openSearch() {
    if (isOpen) {
      requestAnimationFrame(() => {
        document.getElementById("advanced-search")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        document.getElementById("advanced-query")?.focus();
      });
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("search", "open");

    const href = nextParams.toString() ? `${pathname}?${nextParams}` : pathname;
    router.replace(href, { scroll: false });

    requestAnimationFrame(() => {
      document.getElementById("advanced-search")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  return (
    <button
      type="button"
      onClick={openSearch}
      aria-label="Open advanced search"
      aria-expanded={isOpen}
      aria-controls="advanced-search"
      className={`${className ?? ""} ${isOpen ? "opacity-100" : ""}`.trim()}
    >
      <Search size={18} strokeWidth={1.9} />
    </button>
  );
}

export function AdvancedSearchPanel() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = searchParams.get("q") || "";
  const type = searchParams.get("type") || "";
  const platform = searchParams.get("platform") || "";
  const direct = searchParams.get("direct") === "1";
  const hasCriteria = Boolean(query || type || platform || direct);
  const searchState = searchParams.get("search");
  const isOpen = searchState === "open" || (searchState !== "closed" && hasCriteria);

  if (!isOpen) {
    return null;
  }

  return (
    <AdvancedSearchForm
      key={[query, type, platform, direct ? "1" : "", searchState || ""].join("|")}
      pathname={pathname}
      searchParamsString={searchParams.toString()}
      query={query}
      type={type}
      platform={platform}
      direct={direct}
      hasCriteria={hasCriteria}
    />
  );
}

type AdvancedSearchFormProps = {
  pathname: string;
  searchParamsString: string;
  query: string;
  type: string;
  platform: string;
  direct: boolean;
  hasCriteria: boolean;
};

function AdvancedSearchForm({
  pathname,
  searchParamsString,
  query,
  type,
  platform,
  direct,
  hasCriteria,
}: AdvancedSearchFormProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [queryValue, setQueryValue] = useState(query);
  const [typeValue, setTypeValue] = useState(type);
  const [platformValue, setPlatformValue] = useState(platform);
  const [directOnlyValue, setDirectOnlyValue] = useState(direct);
  const [showFilters, setShowFilters] = useState(hasCriteria);
  const hasDraftCriteria = Boolean(
    queryValue.trim() || typeValue || platformValue || directOnlyValue,
  );

  useEffect(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextParams = new URLSearchParams(searchParamsString);

    const nextQuery = queryValue.trim();
    const nextType = typeValue;
    const nextPlatform = platformValue;
    const nextDirect = directOnlyValue ? "1" : "";

    setParam(nextParams, "q", nextQuery);
    setParam(nextParams, "type", nextType);
    setParam(nextParams, "platform", nextPlatform);
    setParam(nextParams, "direct", nextDirect);
    nextParams.set("search", "open");

    const href = nextParams.toString() ? `${pathname}?${nextParams}` : pathname;
    router.replace(href, { scroll: false });

    requestAnimationFrame(() => {
      document.getElementById("explore")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function clearSearch() {
    const nextParams = new URLSearchParams(searchParamsString);
    nextParams.delete("q");
    nextParams.delete("type");
    nextParams.delete("platform");
    nextParams.delete("direct");
    nextParams.delete("search");

    setQueryValue("");
    setTypeValue("");
    setPlatformValue("");
    setDirectOnlyValue(false);
    setShowFilters(false);

    const href = nextParams.toString() ? `${pathname}?${nextParams}` : pathname;
    router.replace(href, { scroll: false });
  }

  function closeSearch() {
    const nextParams = new URLSearchParams(searchParamsString);
    nextParams.set("search", "closed");
    const href = nextParams.toString() ? `${pathname}?${nextParams}` : pathname;
    router.replace(href, { scroll: false });
  }

  return (
    <section id="advanced-search" className="mt-8 scroll-mt-12">
      <form onSubmit={submit} className="overflow-hidden border border-black bg-[#040507] text-white shadow-[0_28px_70px_rgba(5,8,14,0.18)]">
        <div className="px-4 py-5 md:px-8 md:py-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="section-kicker text-white/54">Advanced search</p>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFilters((current) => !current)}
                className="inline-flex items-center gap-2 border border-white/18 px-3 py-2 text-[11px] uppercase tracking-[0.22em] text-white/78 transition hover:border-white/38 hover:text-white"
              >
                <SlidersHorizontal size={14} strokeWidth={1.9} />
                {showFilters ? "Hide filters" : "Advanced filters"}
              </button>

              {hasDraftCriteria ? (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="inline-flex items-center justify-center border border-white/18 px-3 py-2 text-[11px] uppercase tracking-[0.22em] text-white/78 transition hover:border-white/38 hover:text-white"
                >
                  Clear
                </button>
              ) : null}

              <button
                type="button"
                onClick={closeSearch}
                aria-label="Close advanced search"
                className="inline-flex items-center justify-center border border-white/18 px-3 py-2 text-white/78 transition hover:border-white/38 hover:text-white"
              >
                <X size={18} strokeWidth={1.9} />
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-6">
            <div>
              <label htmlFor="advanced-query" className="sr-only">
                Search artists, tracks, albums, EPs, live sessions, genres, labels, and summaries
              </label>
              <div className="border-b border-white/72 pb-4">
                <input
                  ref={inputRef}
                  id="advanced-query"
                  name="q"
                  type="search"
                  inputMode="search"
                  autoComplete="off"
                  enterKeyHint="search"
                  value={queryValue}
                  onChange={(event) => setQueryValue(event.target.value)}
                  placeholder="Search the full music radar"
                  className="editorial-search-input w-full bg-transparent text-[clamp(3.2rem,8.2vw,7.1rem)] leading-[0.9] tracking-[-0.04em] text-white outline-none placeholder:text-white/28 serif-display"
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-white/52">
                <span>Artists</span>
                <span className="h-px w-5 bg-white/18" />
                <span>Tracks</span>
                <span className="h-px w-5 bg-white/18" />
                <span>Albums</span>
                <span className="h-px w-5 bg-white/18" />
                <span>EPs</span>
                <span className="h-px w-5 bg-white/18" />
                <span>Live sessions</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <button
                type="submit"
                className="group inline-flex min-h-16 w-full items-center justify-between gap-5 border border-white/28 px-5 py-4 text-sm uppercase tracking-[0.24em] text-white transition hover:border-white hover:bg-white hover:text-black lg:min-h-24 lg:w-24 lg:justify-center lg:px-0"
              >
                <span className="lg:hidden">Search</span>
                <ArrowRight
                  size={34}
                  strokeWidth={1.6}
                  className="transition-transform group-hover:translate-x-1"
                />
              </button>

              <a
                href="#explore"
                className="inline-flex items-center justify-center text-[11px] uppercase tracking-[0.22em] text-white/56 transition hover:text-white"
              >
                Jump to results
              </a>
            </div>
          </div>

          <p className="mt-5 max-w-3xl text-sm leading-7 text-white/64">
            Search across artist names, release titles, projects, genres, labels, source stories, editorial copy, and AI summaries.
          </p>

          {hasDraftCriteria ? (
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.2em] text-white/58">
              {queryValue.trim() ? (
                <span className="border border-white/14 px-3 py-2">
                  Query: {queryValue.trim()}
                </span>
              ) : null}
              {typeValue ? (
                <span className="border border-white/14 px-3 py-2">
                  Type: {typeValue.replace("_", " ")}
                </span>
              ) : null}
              {platformValue ? (
                <span className="border border-white/14 px-3 py-2">
                  Platform: {platformValue}
                </span>
              ) : null}
              {directOnlyValue ? (
                <span className="border border-white/14 px-3 py-2">
                  Working links only
                </span>
              ) : null}
            </div>
          ) : null}

          {showFilters ? (
            <div className="mt-6 grid gap-4 border-t border-white/12 pt-5 md:grid-cols-2 xl:grid-cols-[minmax(13rem,0.68fr)_minmax(13rem,0.68fr)_auto]">
              <div>
                <label
                  htmlFor="advanced-type"
                  className="mb-2 block text-[11px] uppercase tracking-[0.18em] text-white/52"
                >
                  Release type
                </label>
                <select
                  id="advanced-type"
                  name="type"
                  value={typeValue}
                  onChange={(event) => setTypeValue(event.target.value)}
                  className="w-full border border-white/18 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-white/46"
                >
                  <option value="">All release types</option>
                  <option value="SINGLE">Singles</option>
                  <option value="ALBUM">Albums</option>
                  <option value="EP">EPs</option>
                  <option value="PERFORMANCE">Live / Session</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="advanced-platform"
                  className="mb-2 block text-[11px] uppercase tracking-[0.18em] text-white/52"
                >
                  Platform
                </label>
                <select
                  id="advanced-platform"
                  name="platform"
                  value={platformValue}
                  onChange={(event) => setPlatformValue(event.target.value)}
                  className="w-full border border-white/18 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-white/46"
                >
                  <option value="">Any platform</option>
                  <option value="youtube">YouTube</option>
                  <option value="youtube-music">YouTube Music</option>
                  <option value="bandcamp">Bandcamp</option>
                  <option value="spotify">Spotify</option>
                  <option value="apple-music">Apple Music</option>
                </select>
              </div>

              <div className="flex items-end md:col-span-2 xl:col-span-1">
                <label className="flex w-full items-center gap-3 border border-white/18 bg-white/[0.04] px-4 py-3 text-sm text-white">
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
        </div>
      </form>
    </section>
  );
}

function setParam(params: URLSearchParams, key: string, value: string) {
  if (value) {
    params.set(key, value);
    return;
  }

  params.delete(key);
}
