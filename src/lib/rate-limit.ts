import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";

import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";

type RateLimitConfig = {
  key: string;
  windowMs: number;
  max: number;
};

type MemoryRateLimitBucket = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
  storage: "db" | "memory";
};

declare global {
  var __moosqaRateLimitStore: Map<string, MemoryRateLimitBucket> | undefined;
}

function getRateLimitStore() {
  globalThis.__moosqaRateLimitStore ??= new Map<string, MemoryRateLimitBucket>();
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

export async function takeRateLimit(config: RateLimitConfig, identity: string): Promise<RateLimitResult> {
  try {
    await ensureDatabase();
    return await takeDatabaseRateLimit(config, identity);
  } catch (error) {
    console.error("Persistent rate limit failed, falling back to memory.", error);
    return takeMemoryRateLimit(config, identity);
  }
}

export function createRateLimitResponse(result: RateLimitResult, message: string) {
  return withRateLimitHeaders(
    NextResponse.json({ error: message }, { status: 429 }),
    result,
  );
}

export function withRateLimitHeaders<T extends Response>(response: T, result: RateLimitResult) {
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.floor(result.resetAt / 1000)));
  response.headers.set("Retry-After", String(result.retryAfterSeconds));
  response.headers.set("X-RateLimit-Storage", result.storage);
  return response;
}

async function takeDatabaseRateLimit(config: RateLimitConfig, identity: string): Promise<RateLimitResult> {
  const now = new Date();
  const nextResetAt = new Date(now.getTime() + config.windowMs);
  const bucketKey = `${config.key}:${identity}`;
  const rows = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>(Prisma.sql`
    INSERT INTO "RateLimitEntry" ("key", "count", "resetAt", "createdAt", "updatedAt")
    VALUES (${bucketKey}, 1, ${nextResetAt}, ${now}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitEntry"."resetAt" <= ${now} THEN 1
        ELSE "RateLimitEntry"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitEntry"."resetAt" <= ${now} THEN ${nextResetAt}
        ELSE "RateLimitEntry"."resetAt"
      END,
      "updatedAt" = ${now}
    RETURNING "count", "resetAt";
  `);

  if (now.getMinutes() % 20 === 0 && now.getSeconds() < 8) {
    void prisma.rateLimitEntry.deleteMany({
      where: {
        resetAt: {
          lt: new Date(now.getTime() - 1000 * 60 * 10),
        },
      },
    }).catch(() => undefined);
  }

  const bucket = rows[0];
  const resetAt = bucket.resetAt.getTime();
  const remaining = Math.max(0, config.max - bucket.count);

  return {
    allowed: bucket.count <= config.max,
    limit: config.max,
    remaining,
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now.getTime()) / 1000)),
    storage: "db",
  };
}

function takeMemoryRateLimit(config: RateLimitConfig, identity: string): RateLimitResult {
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
    storage: "memory",
  };
}

function pruneExpiredEntries(store: Map<string, MemoryRateLimitBucket>, now: number) {
  if (store.size < 500) {
    return;
  }

  for (const [key, bucket] of store.entries()) {
    if (bucket.resetAt <= now) {
      store.delete(key);
    }
  }
}
