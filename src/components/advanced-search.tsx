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
      aria-label="Open search"
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
    <section id="advanced-search" className="mt-4 scroll-mt-24">
      <form
        onSubmit={submit}
        className="border border-[var(--color-line)] bg-[var(--color-paper)] shadow-[0_18px_40px_rgba(29,34,48,0.06)]"
      >
        <div className="px-4 py-4 md:px-5 md:py-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="section-kicker text-black/44">Search</p>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFilters((current) => !current)}
                className="inline-flex min-h-10 items-center gap-2 border border-[var(--color-line)] px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-black/66 transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
              >
                <SlidersHorizontal size={14} strokeWidth={1.9} />
                {showFilters ? "Hide filters" : "Filters"}
              </button>

              {hasDraftCriteria ? (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="inline-flex min-h-10 items-center justify-center border border-[var(--color-line)] px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-black/66 transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
                >
                  Clear
                </button>
              ) : null}

              <button
                type="button"
                onClick={closeSearch}
                aria-label="Close search"
                className="inline-flex h-10 w-10 items-center justify-center border border-[var(--color-line)] text-black/66 transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
              >
                <X size={17} strokeWidth={1.9} />
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,1fr)_auto_auto]">
            <label
              htmlFor="advanced-query"
              className="flex min-h-14 items-center gap-3 border border-[var(--color-line)] bg-white px-4 text-[var(--color-ink)]"
            >
              <Search size={20} strokeWidth={1.8} className="shrink-0 text-black/52" />
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
                placeholder="Search artists, tracks, albums, EPs, live sessions"
                className="editorial-search-input min-w-0 flex-1 bg-transparent text-base text-[var(--color-ink)] outline-none placeholder:text-black/36"
              />
            </label>

            <button
              type="submit"
              className="group inline-flex min-h-14 items-center justify-between gap-4 border border-[var(--color-ink)] bg-[var(--color-ink)] px-5 py-3 text-sm uppercase tracking-[0.22em] text-white transition hover:bg-[var(--color-accent-strong)] hover:border-[var(--color-accent-strong)] xl:min-w-40 xl:justify-center"
            >
              <span>Search</span>
              <ArrowRight
                size={18}
                strokeWidth={1.8}
                className="transition-transform group-hover:translate-x-1"
              />
            </button>

            <div className="hidden items-center justify-end text-[11px] uppercase tracking-[0.2em] text-black/46 xl:flex">
              <span>Artists</span>
              <span className="mx-3 h-px w-5 bg-[var(--color-line)]" />
              <span>Releases</span>
              <span className="mx-3 h-px w-5 bg-[var(--color-line)]" />
              <span>Genres</span>
            </div>
          </div>

          {hasDraftCriteria ? (
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-black/54">
              {queryValue.trim() ? (
                <span className="border border-[var(--color-soft-line)] bg-white px-3 py-2">
                  Query: {queryValue.trim()}
                </span>
              ) : null}
              {typeValue ? (
                <span className="border border-[var(--color-soft-line)] bg-white px-3 py-2">
                  Type: {typeValue.replace("_", " ")}
                </span>
              ) : null}
              {platformValue ? (
                <span className="border border-[var(--color-soft-line)] bg-white px-3 py-2">
                  Platform: {platformValue}
                </span>
              ) : null}
              {directOnlyValue ? (
                <span className="border border-[var(--color-soft-line)] bg-white px-3 py-2">
                  Working links only
                </span>
              ) : null}
            </div>
          ) : null}

          {showFilters ? (
            <div className="mt-4 grid gap-3 border-t border-[var(--color-soft-line)] pt-4 md:grid-cols-2 xl:grid-cols-[minmax(12rem,0.72fr)_minmax(12rem,0.72fr)_auto]">
              <div>
                <label
                  htmlFor="advanced-type"
                  className="mb-2 block text-[11px] uppercase tracking-[0.18em] text-black/48"
                >
                  Release type
                </label>
                <select
                  id="advanced-type"
                  name="type"
                  value={typeValue}
                  onChange={(event) => setTypeValue(event.target.value)}
                  className="w-full border border-[var(--color-line)] bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent-strong)]"
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
                  className="mb-2 block text-[11px] uppercase tracking-[0.18em] text-black/48"
                >
                  Platform
                </label>
                <select
                  id="advanced-platform"
                  name="platform"
                  value={platformValue}
                  onChange={(event) => setPlatformValue(event.target.value)}
                  className="w-full border border-[var(--color-line)] bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent-strong)]"
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
                <label className="flex min-h-12 w-full items-center gap-3 border border-[var(--color-line)] bg-white px-4 py-3 text-sm text-[var(--color-ink)]">
                  <input
                    type="checkbox"
                    name="direct"
                    checked={directOnlyValue}
                    onChange={(event) => setDirectOnlyValue(event.target.checked)}
                    className="h-4 w-4 accent-[var(--color-accent-strong)]"
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
