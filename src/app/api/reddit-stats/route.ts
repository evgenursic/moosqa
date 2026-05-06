import {
  createRateLimitResponse,
  getRateLimitIdentity,
  takeMemoryRateLimit,
  withRateLimitHeaders,
} from "@/lib/rate-limit";
import { fetchRedditEngagementMetricsByIds } from "@/lib/reddit";

const REDDIT_STATS_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=240";
const REDDIT_STATS_RATE_LIMIT = {
  key: "api-reddit-stats",
  windowMs: 60_000,
  max: 60,
} as const;

export async function GET(request: Request) {
  const rateLimit = takeMemoryRateLimit(REDDIT_STATS_RATE_LIMIT, getRateLimitIdentity(request));
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit, "Too many Reddit stats requests.");
  }

  const { searchParams } = new URL(request.url);
  const ids = parseRedditIds(searchParams.get("ids"));
  if (ids.length === 0) {
    return withRateLimitHeaders(Response.json({ metrics: [] }, {
      headers: { "Cache-Control": REDDIT_STATS_CACHE_CONTROL },
    }), rateLimit);
  }

  const metrics = await fetchRedditEngagementMetricsByIds(ids);

  return withRateLimitHeaders(Response.json({ metrics }, {
    headers: { "Cache-Control": REDDIT_STATS_CACHE_CONTROL },
  }), rateLimit);
}

function parseRedditIds(value: string | null) {
  return [...new Set((value || "").split(",").map((id) => id.trim()).filter(isRedditId))].slice(0, 100);
}

function isRedditId(value: string) {
  return /^[a-z0-9]{5,12}$/i.test(value);
}
