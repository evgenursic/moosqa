import { getSearchOverlayPayload } from "@/lib/search-overlay";
import {
  createRateLimitResponse,
  getRateLimitIdentity,
  takeRateLimit,
  withRateLimitHeaders,
} from "@/lib/rate-limit";

const SEARCH_FACETS_RATE_LIMIT = {
  key: "api-search-facets",
  windowMs: 60_000,
  max: 30,
} as const;

export async function GET(request: Request) {
  const rateLimit = await takeRateLimit(SEARCH_FACETS_RATE_LIMIT, getRateLimitIdentity(request));
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit, "Too many facet requests.");
  }

  const payload = await getSearchOverlayPayload();

  return withRateLimitHeaders(Response.json({
    genres: payload.genres,
  }), rateLimit);
}
