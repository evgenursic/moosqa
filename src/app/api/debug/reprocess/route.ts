import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { getRequiredDebugSecret, readRequestSecret } from "@/lib/admin-auth";
import {
  createRateLimitResponse,
  getRateLimitIdentity,
  takeRateLimit,
  withRateLimitHeaders,
} from "@/lib/rate-limit";
import { runWeakCardReprocess } from "@/lib/sync-releases";

const DEBUG_REPROCESS_RATE_LIMIT = {
  key: "api-debug-reprocess",
  windowMs: 10 * 60_000,
  max: 4,
} as const;

export async function POST(request: Request) {
  const rateLimit = takeRateLimit(
    DEBUG_REPROCESS_RATE_LIMIT,
    getRateLimitIdentity(request),
  );
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit, "Too many debug reprocess requests.");
  }

  const { searchParams } = new URL(request.url);
  const secret = readRequestSecret(request, {
    queryParam: "secret",
    headerName: "x-debug-secret",
  });
  const allowedSecret = getRequiredDebugSecret();

  if (!allowedSecret || secret !== allowedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = clampReprocessLimit(searchParams.get("limit"));
  const result = await runWeakCardReprocess(limit);

  revalidatePath("/");
  revalidatePath("/debug");
  revalidateTag("releases", "max");

  return withRateLimitHeaders(NextResponse.json({
    ok: true,
    mode: "manual-reprocess",
    ...result,
    processedAt: new Date().toISOString(),
  }), rateLimit);
}

function clampReprocessLimit(value: string | null) {
  const parsed = Number.parseInt(value || "", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 12;
  }

  return Math.min(parsed, 24);
}
