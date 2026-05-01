import { getSearchOverlayPayload } from "@/lib/search-overlay";
import {
  createRateLimitResponse,
  getRateLimitIdentity,
  takeMemoryRateLimit,
  withRateLimitHeaders,
} from "@/lib/rate-limit";

const SEARCH_INDEX_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=3600";
const SEARCH_INDEX_RATE_LIMIT = {
  key: "api-search-index",
  windowMs: 60_000,
  max: 30,
} as const;

export async function GET(request: Request) {
  const rateLimit = takeMemoryRateLimit(SEARCH_INDEX_RATE_LIMIT, getRateLimitIdentity(request));
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit, "Too many search index requests.");
  }

  const payload = await getSearchOverlayPayload();

  return withRateLimitHeaders(Response.json(payload, {
    headers: {
      "Cache-Control": SEARCH_INDEX_CACHE_CONTROL,
    },
  }), rateLimit);
}
