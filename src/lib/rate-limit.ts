import { NextResponse } from "next/server";

type RateLimitConfig = {
  key: string;
  windowMs: number;
  max: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

declare global {
  var __moosqaRateLimitStore: Map<string, RateLimitBucket> | undefined;
}

function getRateLimitStore() {
  globalThis.__moosqaRateLimitStore ??= new Map<string, RateLimitBucket>();
  return globalThis.__moosqaRateLimitStore;
}

export function getRateLimitIdentity(request: Request, suffix?: string | null) {
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const realIp = request.headers.get("x-real-ip") || "";
  const cfIp = request.headers.get("cf-connecting-ip") || "";
  const ip =
    forwardedFor.split(",")[0]?.trim() ||
    realIp.trim() ||
    cfIp.trim() ||
    "anonymous";
  const userAgent = request.headers.get("user-agent")?.slice(0, 60) || "unknown";

  return suffix ? `${ip}:${userAgent}:${suffix}` : `${ip}:${userAgent}`;
}

export function takeRateLimit(config: RateLimitConfig, identity: string) {
  const now = Date.now();
  const store = getRateLimitStore();
  pruneExpiredEntries(store, now);

  const bucketKey = `${config.key}:${identity}`;
  const current = store.get(bucketKey);
  const nextBucket =
    !current || current.resetAt <= now
      ? { count: 1, resetAt: now + config.windowMs }
      : { count: current.count + 1, resetAt: current.resetAt };

  store.set(bucketKey, nextBucket);

  const remaining = Math.max(0, config.max - nextBucket.count);
  return {
    allowed: nextBucket.count <= config.max,
    limit: config.max,
    remaining,
    resetAt: nextBucket.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((nextBucket.resetAt - now) / 1000)),
  };
}

export function createRateLimitResponse(result: ReturnType<typeof takeRateLimit>, message: string) {
  return withRateLimitHeaders(
    NextResponse.json({ error: message }, { status: 429 }),
    result,
  );
}

export function withRateLimitHeaders<T extends Response>(
  response: T,
  result: ReturnType<typeof takeRateLimit>,
) {
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.floor(result.resetAt / 1000)));
  response.headers.set("Retry-After", String(result.retryAfterSeconds));
  return response;
}

function pruneExpiredEntries(store: Map<string, RateLimitBucket>, now: number) {
  if (store.size < 500) {
    return;
  }

  for (const [key, bucket] of store.entries()) {
    if (bucket.resetAt <= now) {
      store.delete(key);
    }
  }
}
