import { NextResponse } from "next/server";

import { getPublicHealthSummary } from "@/lib/ops-dashboard";
import { buildPublicHealthPayload, buildPublicReadinessPayload } from "@/lib/public-health";
import {
  createRateLimitResponse,
  getRateLimitIdentity,
  takeMemoryRateLimit,
  withRateLimitHeaders,
} from "@/lib/rate-limit";

const HEALTH_RATE_LIMIT = {
  key: "api-health",
  windowMs: 60_000,
  max: 120,
} as const;

export async function GET(request: Request) {
  const rateLimit = takeMemoryRateLimit(HEALTH_RATE_LIMIT, getRateLimitIdentity(request));
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit, "Too many health check requests.");
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get("scope") === "ready") {
    return withRateLimitHeaders(NextResponse.json(buildPublicReadinessPayload()), rateLimit);
  }

  try {
    const summary = await getPublicHealthSummary();
    return withRateLimitHeaders(NextResponse.json(buildPublicHealthPayload(summary)), rateLimit);
  } catch (error) {
    console.error("Public health check failed.", error);
    return withRateLimitHeaders(
      NextResponse.json(
        {
          ok: false,
          status: "unavailable",
          generatedAt: new Date().toISOString(),
          error: "Health check unavailable.",
        },
        { status: 503 },
      ),
      rateLimit,
    );
  }
}
