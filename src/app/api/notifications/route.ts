import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { getRequiredCronSecret, isValidRequestSecret, readRequestSecret } from "@/lib/admin-auth";
import {
  createRateLimitResponse,
  getRateLimitIdentity,
  takeRateLimit,
  withRateLimitHeaders,
} from "@/lib/rate-limit";
import { runNotificationDigestCycle } from "@/lib/notifications";

const NOTIFICATIONS_RATE_LIMIT = {
  key: "api-notifications",
  windowMs: 60_000,
  max: 12,
} as const;

export async function GET(request: Request) {
  const secret = readRequestSecret(request, {
    queryParam: "secret",
    headerName: "x-cron-secret",
  });
  const allowedSecret = getRequiredCronSecret();

  if (!allowedSecret) {
    return NextResponse.json({ error: "Cron secret is not configured." }, { status: 503 });
  }

  if (!isValidRequestSecret(secret, allowedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await takeRateLimit(NOTIFICATIONS_RATE_LIMIT, getRateLimitIdentity(request));
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit, "Too many notification job requests.");
  }

  const { searchParams } = new URL(request.url);
  const mode = readMode(searchParams.get("mode"));
  const phase = readPhase(searchParams.get("phase"));
  const limit = readLimit(searchParams.get("limit"));

  const result = await runNotificationDigestCycle({
    mode,
    phase,
    limit,
  });

  revalidateTag("ops-dashboard", "max");

  return withRateLimitHeaders(
    NextResponse.json(
      {
        ...result,
        triggeredAt: new Date().toISOString(),
      },
      {
        status: result.ok ? 200 : 503,
      },
    ),
    rateLimit,
  );
}

function readMode(value: string | null): "daily" | "weekly" | "all" {
  if (value === "daily" || value === "weekly") {
    return value;
  }

  return "all";
}

function readPhase(value: string | null): "enqueue" | "send" | "all" {
  if (value === "enqueue" || value === "send") {
    return value;
  }

  return "all";
}

function readLimit(value: string | null) {
  const parsed = Number.parseInt(value || "", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return undefined;
  }

  return Math.min(parsed, 20);
}
