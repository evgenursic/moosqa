import { after } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { readRequestSecret } from "@/lib/admin-auth";
import { evaluateProductionAlerts } from "@/lib/analytics";
import { warmCriticalCaches } from "@/lib/cache-warming";
import {
  createRateLimitResponse,
  getRateLimitIdentity,
  takeRateLimit,
  withRateLimitHeaders,
} from "@/lib/rate-limit";
import {
  runQualityEnrichmentCycle,
  runWeakCardReprocess,
  syncIndieheadsReleases,
} from "@/lib/sync-releases";

const SYNC_RATE_LIMIT = {
  key: "api-sync",
  windowMs: 60_000,
  max: 12,
} as const;

export async function GET(request: Request) {
  const rateLimit = await takeRateLimit(SYNC_RATE_LIMIT, getRateLimitIdentity(request));
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit, "Too many sync requests.");
  }

  const { searchParams } = new URL(request.url);
  const secret = readRequestSecret(request, {
    queryParam: "secret",
    headerName: "x-cron-secret",
  });

  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wantsQualityOnly =
    searchParams.get("quality") === "1" || searchParams.get("deep") === "1";
  const wantsRepairOnly = searchParams.get("repair") === "1";
  const wantsEnrichment = searchParams.get("enrich") === "1";

  try {
    if (wantsQualityOnly) {
      const limit = clampQualityLimit(searchParams.get("limit"));
      const result = await runQualityEnrichmentCycle(limit);
      revalidatePath("/");
      revalidateTag("releases", "max");
      await evaluateProductionAlerts();
      revalidateTag("ops-dashboard", "max");
      revalidateTag("quality-dashboard", "max");
      after(async () => {
        await warmCriticalCaches().catch((error) => {
          console.error("Cache warming after quality sync failed.", error);
        });
      });

      return withRateLimitHeaders(NextResponse.json({
        ok: true,
        mode: "quality",
        ...result,
        syncedAt: new Date().toISOString(),
      }), rateLimit);
    }

    if (wantsRepairOnly) {
      const limit = clampQualityLimit(searchParams.get("limit"));
      const result = await runWeakCardReprocess(limit);
      revalidatePath("/");
      revalidateTag("releases", "max");
      await evaluateProductionAlerts();
      revalidateTag("ops-dashboard", "max");
      revalidateTag("quality-dashboard", "max");
      after(async () => {
        await warmCriticalCaches().catch((error) => {
          console.error("Cache warming after repair sync failed.", error);
        });
      });

      return withRateLimitHeaders(NextResponse.json({
        ok: true,
        mode: "repair",
        ...result,
        syncedAt: new Date().toISOString(),
      }), rateLimit);
    }

    const result = await syncIndieheadsReleases({
      enrich: wantsEnrichment,
      lightweight: !wantsEnrichment,
    });
    revalidatePath("/");
    revalidateTag("releases", "max");
    await evaluateProductionAlerts();
    revalidateTag("ops-dashboard", "max");
    revalidateTag("quality-dashboard", "max");
    after(async () => {
      await warmCriticalCaches().catch((error) => {
        console.error("Cache warming after sync failed.", error);
      });
    });

    return withRateLimitHeaders(NextResponse.json({
      ok: true,
      ...result,
      syncedAt: new Date().toISOString(),
    }), rateLimit);
  } catch (error) {
    await evaluateProductionAlerts().catch(() => undefined);
    throw error;
  }
}

function clampQualityLimit(value: string | null) {
  const parsed = Number.parseInt(value || "", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 6;
  }

  return Math.min(parsed, 12);
}
