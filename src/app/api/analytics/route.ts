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

export async function POST(request: Request) {
  const rateLimit = await takeRateLimit(ANALYTICS_RATE_LIMIT, getRateLimitIdentity(request));
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit, "Too many analytics requests.");
  }

  const body = analyticsSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid analytics payload." }, { status: 400 });
  }

  try {
    await recordAnalyticsEvent({
      ...body.data,
      request,
    });
  } catch (error) {
    console.error("Analytics event could not be recorded.", error);
    return NextResponse.json({ error: "Analytics write failed." }, { status: 500 });
  }

  return withRateLimitHeaders(NextResponse.json({ ok: true }), rateLimit);
}
