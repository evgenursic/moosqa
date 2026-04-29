"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { ReleaseArtwork } from "@/components/release-artwork";
import { ReleaseLink } from "@/components/release-link";
import { ReleaseMetricBadge } from "@/components/release-metric-badge";
import { loadSearchIndex, readCachedSearchIndex } from "@/lib/client-search-index";
import { type SearchOverlayIndexItem } from "@/lib/search-overlay";
import { getPopularityMaxForReleases } from "@/lib/release-metrics";
import { filterAndRankReleaseListings } from "@/lib/release-search";
import { formatRedditDateLabel, formatReleaseTypeLabel, getDisplayGenre, getDisplaySummary } from "@/lib/utils";

const ACTIVE_RESULTS_LIMIT = 12;

type SearchResultItem = SearchOverlayIndexItem;

type SearchResponse = {
  total: number;
  results: SearchResultItem[];
};

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
  const currentGenre = searchParams.get("genre") || "";
  const currentPlatform = searchParams.get("platform") || "";
  const currentDirect = searchParams.get("direct") === "1";
  const searchKey = `${currentQuery}|${currentType}|${currentGenre}|${currentPlatform}|${
    currentDirect ? "1" : "0"
  }`;

  if (!isOpen) {
    return null;
  }

  return (
    <AdvancedSearchDialog
      key={searchKey}
      onClose={onClose}
      initialQuery={currentQuery}
      initialType={currentType}
      initialGenre={currentGenre}
      initialPlatform={currentPlatform}
      initialDirect={currentDirect}
    />
  );
}

type AdvancedSearchDialogProps = {
  onClose: () => void;
  initialQuery: string;
  initialType: string;
  initialGenre: string;
  initialPlatform: string;
  initialDirect: boolean;
};

function AdvancedSearchDialog({
  onClose,
  initialQuery,
  initialType,
  initialGenre,
  initialPlatform,
  initialDirect,
}: AdvancedSearchDialogProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultsCacheRef = useRef<Map<string, SearchResponse>>(new Map());
  const cachedSearchPayload = readCachedSearchIndex();
  const [queryValue, setQueryValue] = useState(initialQuery);
  const [typeValue, setTypeValue] = useState(initialType);
  const [genreValue, setGenreValue] = useState(initialGenre);
  const [platformValue, setPlatformValue] = useState(initialPlatform);
  const [directOnlyValue, setDirectOnlyValue] = useState(initialDirect);
  const [showFilters, setShowFilters] = useState(
    Boolean(initialType || initialGenre || initialPlatform || initialDirect),
  );
  const [genreOptions, setGenreOptions] = useState<string[]>(cachedSearchPayload?.genres || []);
  const [searchIndex, setSearchIndex] = useState<SearchResultItem[]>(cachedSearchPayload?.results || []);
  const [isIndexLoading, setIsIndexLoading] = useState(!cachedSearchPayload);
  const [indexError, setIndexError] = useState<Error | null>(null);
  const [remoteResults, setRemoteResults] = useState<SearchResultItem[]>([]);
  const [remoteResultTotal, setRemoteResultTotal] = useState(0);
  const [isRemoteSearching, setIsRemoteSearching] = useState(false);
  const [hasLoadedRemoteResults, setHasLoadedRemoteResults] = useState(false);
  const deferredQuery = useDeferredValue(queryValue.trim());
  const hasStructuredFilters = Boolean(typeValue || genreValue || platformValue || directOnlyValue);
  const shouldSearch = deferredQuery.length >= 2 || hasStructuredFilters;

  const hasDraftCriteria = Boolean(
    queryValue.trim() || typeValue || genreValue || platformValue || directOnlyValue,
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

  useEffect(() => {
    const seededPayload = readCachedSearchIndex();
    if (seededPayload) {
      setGenreOptions(seededPayload.genres || []);
      setSearchIndex(seededPayload.results || []);
      setIsIndexLoading(false);
      return;
    }

    let isMounted = true;
    setIsIndexLoading(true);

    void loadSearchIndex()
      .then((payload) => {
        if (!isMounted) {
          return;
        }

        setGenreOptions(payload.genres || []);
        setSearchIndex(payload.results || []);
        setIndexError(null);
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        console.error(error);
        setIndexError(
          error instanceof Error ? error : new Error("Search index failed to load."),
        );
      })
      .finally(() => {
        if (isMounted) {
          setIsIndexLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const indexedResults = useMemo(() => {
    if (searchIndex.length === 0) {
      return [] as SearchResultItem[];
    }

    return filterAndRankReleaseListings(searchIndex, {
      query: deferredQuery,
      type: typeValue,
      genre: genreValue,
      platform: platformValue,
      directOnly: directOnlyValue,
    });
  }, [deferredQuery, directOnlyValue, genreValue, platformValue, searchIndex, typeValue]);

  useEffect(() => {
    if (!indexError || !shouldSearch) {
      setRemoteResults([]);
      setRemoteResultTotal(0);
      setIsRemoteSearching(false);
      setHasLoadedRemoteResults(false);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams();
    const cacheKey = [
      deferredQuery,
      typeValue,
      genreValue,
      platformValue,
      directOnlyValue ? "1" : "0",
    ].join("|");

    setParam(params, "q", deferredQuery);
    setParam(params, "type", typeValue);
    setParam(params, "genre", genreValue);
    setParam(params, "platform", platformValue);
    setParam(params, "direct", directOnlyValue ? "1" : "");
    params.set("limit", String(ACTIVE_RESULTS_LIMIT));

    const cachedResponse = resultsCacheRef.current.get(cacheKey);
    if (cachedResponse) {
      setRemoteResults(cachedResponse.results || []);
      setRemoteResultTotal(cachedResponse.total || 0);
      setHasLoadedRemoteResults(true);
      setIsRemoteSearching(false);
      return () => controller.abort();
    }

    const timeoutId = window.setTimeout(async () => {
      setIsRemoteSearching(true);

      try {
        const response = await fetch(`/api/search?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Search request failed with ${response.status}`);
        }

        const payload = (await response.json()) as SearchResponse;
        resultsCacheRef.current.set(cacheKey, payload);
        setRemoteResults(payload.results || []);
        setRemoteResultTotal(payload.total || 0);
        setHasLoadedRemoteResults(true);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error(error);
        setRemoteResults([]);
        setRemoteResultTotal(0);
        setHasLoadedRemoteResults(true);
      } finally {
        if (!controller.signal.aborted) {
          setIsRemoteSearching(false);
        }
      }
    }, 90);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [deferredQuery, directOnlyValue, genreValue, indexError, platformValue, shouldSearch, typeValue]);

  const activeResults = indexError
    ? remoteResults
    : indexedResults.slice(0, ACTIVE_RESULTS_LIMIT);
  const activeResultTotal = indexError ? remoteResultTotal : indexedResults.length;
  const isSearching = indexError ? isRemoteSearching : isIndexLoading && shouldSearch;
  const hasLoadedResults = indexError ? hasLoadedRemoteResults : !isIndexLoading;

  function clearSearch() {
    setQueryValue("");
    setTypeValue("");
    setGenreValue("");
    setPlatformValue("");
    setDirectOnlyValue(false);
    setShowFilters(false);

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }

  function openFullResults() {
    const params = new URLSearchParams();
    setParam(params, "q", queryValue.trim());
    setParam(params, "type", typeValue);
    setParam(params, "genre", genreValue);
    setParam(params, "platform", platformValue);
    setParam(params, "direct", directOnlyValue ? "1" : "");

    const queryString = params.toString();
    router.push(queryString ? `/?${queryString}#explore` : "/");
    onClose();
  }

  return (
    <div
      id="advanced-search-overlay"
      className="fixed inset-0 z-[260] overflow-y-auto bg-[rgba(13,18,28,0.97)] text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Advanced search"
    >
      <div className="mx-auto min-h-screen max-w-[1480px] px-4 py-5 md:px-8 md:py-7">
        <div>
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

          <div className="flex flex-wrap items-center justify-end gap-2 border-b border-white/8 py-4 text-[11px] uppercase tracking-[0.2em] text-white/54 md:py-5">
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
                <>
                  <button
                    type="button"
                    onClick={openFullResults}
                    className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-white/12 px-4 py-2 transition hover:border-white/24 hover:bg-white/6 hover:text-white"
                  >
                    View all
                  </button>

                  <button
                    type="button"
                    onClick={clearSearch}
                    className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-white/12 px-4 py-2 transition hover:border-white/24 hover:bg-white/6 hover:text-white"
                  >
                    Clear
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {showFilters ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(12rem,0.72fr)_minmax(14rem,0.9fr)_minmax(12rem,0.72fr)_auto]">
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
                  htmlFor="advanced-genre"
                  className="mb-2 block text-[11px] uppercase tracking-[0.18em] text-white/46"
                >
                  Genre
                </label>
                <select
                  id="advanced-genre"
                  name="genre"
                  value={genreValue}
                  onChange={(event) => setGenreValue(event.target.value)}
                  className="w-full rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-sm text-white outline-none transition focus:border-white/28"
                >
                  <option value="" className="bg-[#0f1521]">
                    Any genre
                  </option>
                  {genreOptions.map((genre) => (
                    <option key={genre} value={genre} className="bg-[#0f1521]">
                      {genre}
                    </option>
                  ))}
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

        <SearchLiveResults
          query={queryValue.trim()}
          shouldSearch={shouldSearch}
          hasDraftCriteria={hasDraftCriteria}
          results={activeResults}
          total={activeResultTotal}
          isSearching={isSearching}
          hasLoadedResults={hasLoadedResults}
          fromHref={buildOverlayResultsHref({
            query: queryValue.trim(),
            type: typeValue,
            genre: genreValue,
            platform: platformValue,
            directOnly: directOnlyValue,
          })}
          onResultSelect={onClose}
        />
      </div>
      </div>
    </div>
  );
}

function SearchLiveResults({
  query,
  shouldSearch,
  hasDraftCriteria,
  results,
  total,
  isSearching,
  hasLoadedResults,
  fromHref,
  onResultSelect,
}: {
  query: string;
  shouldSearch: boolean;
  hasDraftCriteria: boolean;
  results: SearchResultItem[];
  total: number;
  isSearching: boolean;
  hasLoadedResults: boolean;
  fromHref: string;
  onResultSelect: () => void;
}) {
  if (isSearching && !hasLoadedResults) {
    return (
      <div className="mt-6 grid gap-3 md:mt-8">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="grid animate-pulse gap-4 border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[12rem_1fr]"
          >
            <div className="aspect-[4/3] bg-white/8 md:aspect-[16/10]" />
            <div>
              <div className="h-3 w-28 bg-white/10" />
              <div className="mt-4 h-8 w-3/4 bg-white/12" />
              <div className="mt-3 h-14 w-full bg-white/8" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!shouldSearch && query.length === 1) {
    return (
      <div className="mt-6 border border-white/10 bg-white/[0.03] p-5 text-sm leading-7 text-white/64 md:mt-8">
        Type at least 2 characters to search the archive.
      </div>
    );
  }

  if (!shouldSearch) {
    return (
      <div className="mt-6 border border-white/10 bg-white/[0.03] p-5 text-sm leading-7 text-white/64 md:mt-8">
        Start typing to search artists, tracks, albums, EPs, and live sessions.
      </div>
    );
  }

  if (!results.length) {
    return (
      <div className="mt-6 border border-white/10 bg-white/[0.03] p-5 text-sm leading-7 text-white/64 md:mt-8">
        No releases match the current search.
      </div>
    );
  }

  const popularityMaxRaw = getPopularityMaxForReleases(results);

  return (
    <div className="mt-6 md:mt-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em] text-white/48">
        <span>{Math.min(results.length, total)} of {total} results</span>
        {hasDraftCriteria && query ? <span>Searching: {query}</span> : null}
      </div>

      <div className="grid gap-3">
        {results.map((result) => (
          <ReleaseLink
            key={result.id}
            slug={result.slug}
            fromHref={fromHref}
            onClick={onResultSelect}
            className="group grid gap-4 border border-white/10 bg-white/[0.03] p-4 transition duration-300 hover:border-white/24 hover:bg-white/[0.045] md:grid-cols-[12rem_1fr]"
          >
            <div className="relative">
              <ReleaseArtwork
                releaseId={result.id}
                title={result.title}
                artistName={result.artistName}
                projectTitle={result.projectTitle}
                imageUrl={result.imageUrl}
                thumbnailUrl={result.thumbnailUrl}
                sourceUrl={result.sourceUrl || null}
                youtubeUrl={result.youtubeUrl || null}
                youtubeMusicUrl={result.youtubeMusicUrl || null}
                bandcampUrl={result.bandcampUrl || null}
                officialWebsiteUrl={result.officialWebsiteUrl || null}
                officialStoreUrl={result.officialStoreUrl || null}
                genreName={result.genreName}
                imageClassName="aspect-[4/3] md:aspect-[16/10]"
              />
              <ReleaseMetricBadge
                sourceUrl={result.sourceUrl || null}
                outletName={result.outletName || null}
                youtubeViewCount={result.youtubeViewCount}
                redditUpvotes={result.score}
                redditComments={result.commentCount}
                popularityMaxRaw={popularityMaxRaw ?? result.popularityMaxRaw ?? null}
                bandcampSupporterCount={result.bandcampSupporterCount}
                bandcampFollowerCount={result.bandcampFollowerCount}
                fallbackLabel={formatReleaseTypeLabel(result.releaseType)}
                className="absolute right-2 top-2 z-10 max-w-[calc(100%-1rem)]"
                compact
                tone="dark"
              />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-white/50">
                <span>{getDisplayGenre(result.genreName, result.releaseType)}</span>
                <span>{formatReleaseTypeLabel(result.releaseType)}</span>
                <span>{formatRedditDateLabel(new Date(result.publishedAt))}</span>
              </div>

              <h3 className="mt-3 text-[1.9rem] leading-[0.94] text-white serif-display md:text-[2.25rem]">
                <span className="card-title-underline">
                  {result.artistName || result.projectTitle || result.title}
                </span>
              </h3>

              <p className="mt-2 text-lg leading-7 text-white/72 serif-display">
                {result.artistName && result.projectTitle ? result.projectTitle : result.title}
              </p>

              <p className="mt-4 text-sm leading-6 text-white/68">
                {getDisplaySummary({
                  aiSummary: result.aiSummary,
                  summary: result.summary,
                  artistName: result.artistName,
                  projectTitle: result.projectTitle,
                  title: result.title,
                  releaseType: result.releaseType,
                  genreName: result.genreName,
                })}
              </p>
            </div>
          </ReleaseLink>
        ))}
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

function buildOverlayResultsHref(input: {
  query: string;
  type: string;
  genre: string;
  platform: string;
  directOnly: boolean;
}) {
  const params = new URLSearchParams();
  setParam(params, "q", input.query);
  setParam(params, "type", input.type);
  setParam(params, "genre", input.genre);
  setParam(params, "platform", input.platform);
  setParam(params, "direct", input.directOnly ? "1" : "");
  const query = params.toString();
  return query ? `/?${query}#explore` : "/#explore";
}
