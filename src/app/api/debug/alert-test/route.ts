import { NextResponse } from "next/server";

import { getRequiredDebugSecret, readRequestSecret } from "@/lib/admin-auth";
import { sendProductionAlertTest, type AlertDeliveryTestChannel } from "@/lib/analytics";
import {
  createRateLimitResponse,
  getRateLimitIdentity,
  takeRateLimit,
  withRateLimitHeaders,
} from "@/lib/rate-limit";

const DEBUG_ALERT_TEST_RATE_LIMIT = {
  key: "api-debug-alert-test",
  windowMs: 10 * 60_000,
  max: 8,
} as const;

export async function POST(request: Request) {
  const rateLimit = await takeRateLimit(DEBUG_ALERT_TEST_RATE_LIMIT, getRateLimitIdentity(request));
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit, "Too many alert delivery tests.");
  }

  const secret = readRequestSecret(request, {
    queryParam: "secret",
    headerName: "x-debug-secret",
  });
  const allowedSecret = getRequiredDebugSecret();

  if (!allowedSecret || secret !== allowedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const channel = parseChannel(searchParams.get("channel"));
  const result = await sendProductionAlertTest(channel);

  return withRateLimitHeaders(
    NextResponse.json({
      ok: result.ok,
      channel,
      results: result.results,
      testedAt: new Date().toISOString(),
    }),
    rateLimit,
  );
}

function parseChannel(value: string | null): AlertDeliveryTestChannel {
  if (value === "discord" || value === "slack" || value === "email") {
    return value;
  }

  return "all";
}
