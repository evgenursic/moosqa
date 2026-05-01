import { filterAndRankReleaseListings } from "@/lib/release-search";
import { getSearchReleases } from "@/lib/release-sections";
import {
  createRateLimitResponse,
  getRateLimitIdentity,
  takeMemoryRateLimit,
  withRateLimitHeaders,
} from "@/lib/rate-limit";

const SEARCH_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300";
const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 16;
const SEARCH_RATE_LIMIT = {
  key: "api-search",
  windowMs: 60_000,
  max: 40,
} as const;

export async function GET(request: Request) {
  const rateLimit = takeMemoryRateLimit(SEARCH_RATE_LIMIT, getRateLimitIdentity(request));
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit, "Too many search requests.");
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const type = searchParams.get("type") || "";
  const genre = searchParams.get("genre") || "";
  const platform = searchParams.get("platform") || "";
  const directOnly = searchParams.get("direct") === "1";
  const limit = clampLimit(searchParams.get("limit"));

  const releases = await getSearchReleases();
  const filtered = filterAndRankReleaseListings(releases, {
    query,
    type,
    genre,
    platform,
    directOnly,
  });

  return withRateLimitHeaders(Response.json({
    total: filtered.length,
    results: filtered.slice(0, limit).map((release) => ({
      ...release,
      publishedAt: release.publishedAt.toISOString(),
    })),
  }, {
    headers: {
      "Cache-Control": SEARCH_CACHE_CONTROL,
    },
  }), rateLimit);
}

function clampLimit(value: string | null) {
  const parsed = Number.parseInt(value || "", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
}
