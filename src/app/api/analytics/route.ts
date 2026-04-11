import { NextResponse } from "next/server";
import { z } from "zod";

import { recordAnalyticsEvent } from "@/lib/analytics";
import {
  createRateLimitResponse,
  getRateLimitIdentity,
  takeRateLimit,
  withRateLimitHeaders,
} from "@/lib/rate-limit";

const analyticsSchema = z.object({
  releaseId: z.string().min(1).optional().nullable(),
  action: z.enum([
    "OPEN",
    "LISTEN_CLICK",
    "VOTE",
    "SHARE",
    "REACTION_POSITIVE",
    "REACTION_NEGATIVE",
  ]),
  platform: z.string().max(80).optional().nullable(),
  href: z.string().max(500).optional().nullable(),
  sourcePath: z.string().max(280).optional().nullable(),
  deviceKey: z.string().max(120).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

const ANALYTICS_RATE_LIMIT = {
  key: "api-analytics",
  windowMs: 60_000,
  max: 80,
} as const;
const REACTION_RATE_LIMIT = {
  key: "api-analytics-reaction",
  windowMs: 60_000,
  max: 12,
} as const;
const SHARE_RATE_LIMIT = {
  key: "api-analytics-share",
  windowMs: 60_000,
  max: 10,
} as const;

export async function POST(request: Request) {
  const body = analyticsSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid analytics payload." }, { status: 400 });
  }

  const rateLimit = await takeRateLimit(
    ANALYTICS_RATE_LIMIT,
    getRateLimitIdentity(request, body.data.releaseId || body.data.action),
  );
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit, "Too many analytics requests.");
  }

  if (
    body.data.releaseId &&
    (body.data.action === "REACTION_POSITIVE" || body.data.action === "REACTION_NEGATIVE")
  ) {
    const reactionLimit = await takeRateLimit(
      REACTION_RATE_LIMIT,
      getRateLimitIdentity(request, `${body.data.releaseId}:${body.data.action}`),
    );
    if (!reactionLimit.allowed) {
      return createRateLimitResponse(reactionLimit, "Too many reaction requests.");
    }
  }

  if (body.data.releaseId && body.data.action === "SHARE") {
    const shareLimit = await takeRateLimit(
      SHARE_RATE_LIMIT,
      getRateLimitIdentity(request, `${body.data.releaseId}:share`),
    );
    if (!shareLimit.allowed) {
      return createRateLimitResponse(shareLimit, "Too many share requests.");
    }
  }

  try {
    const result = await recordAnalyticsEvent({
      ...body.data,
      request,
    });
    return withRateLimitHeaders(NextResponse.json(result), rateLimit);
  } catch (error) {
    console.error("Analytics event could not be recorded.", error);
    return NextResponse.json({ error: "Analytics write failed." }, { status: 500 });
  }
}
