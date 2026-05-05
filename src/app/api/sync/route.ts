import { after } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { getRequiredCronSecret, isValidRequestSecret, readRequestSecret } from "@/lib/admin-auth";
import { updateWorkflowRunState } from "@/lib/analytics";
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

type SyncEndpointMode = "sync" | "quality" | "repair";

const SYNC_RATE_LIMIT = {
  key: "api-sync",
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

  const rateLimit = await takeRateLimit(SYNC_RATE_LIMIT, getRateLimitIdentity(request));
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit, "Too many sync requests.");
  }

  const { searchParams } = new URL(request.url);
  const wantsQualityOnly =
    searchParams.get("quality") === "1" || searchParams.get("deep") === "1";
  const wantsRepairOnly = searchParams.get("repair") === "1";
  const wantsEnrichment = searchParams.get("enrich") === "1";
  const mode: SyncEndpointMode = wantsQualityOnly ? "quality" : wantsRepairOnly ? "repair" : "sync";

  try {
    if (wantsQualityOnly) {
      const limit = clampQualityLimit(searchParams.get("limit"));
      const result = await runQualityEnrichmentCycle(limit);
      revalidatePath("/");
      revalidateTag("releases", "max");
      revalidateTag("ops-dashboard", "max");
      revalidateTag("quality-dashboard", "max");
      const payload = {
        ok: true,
        mode: "quality",
        ...result,
        syncedAt: new Date().toISOString(),
      };
      schedulePostSyncMaintenance("quality", payload);

      return withRateLimitHeaders(NextResponse.json(payload), rateLimit);
    }

    if (wantsRepairOnly) {
      const limit = clampQualityLimit(searchParams.get("limit"));
      const result = await runWeakCardReprocess(limit);
      revalidatePath("/");
      revalidateTag("releases", "max");
      revalidateTag("ops-dashboard", "max");
      revalidateTag("quality-dashboard", "max");
      const payload = {
        ok: true,
        mode: "repair",
        ...result,
        syncedAt: new Date().toISOString(),
      };
      schedulePostSyncMaintenance("repair", payload);

      return withRateLimitHeaders(NextResponse.json(payload), rateLimit);
    }

    const result = await syncIndieheadsReleases({
      enrich: wantsEnrichment,
      lightweight: !wantsEnrichment,
    });
    revalidatePath("/");
    revalidateTag("releases", "max");
    revalidateTag("ops-dashboard", "max");
    revalidateTag("quality-dashboard", "max");
    const payload = {
      ok: true,
      ...result,
      syncedAt: new Date().toISOString(),
    };
    schedulePostSyncMaintenance("sync", payload);

    return withRateLimitHeaders(NextResponse.json(payload), rateLimit);
  } catch (error) {
    await updateWorkflowRunState({
      workflowName: mode,
      status: "FAILURE",
      branch: getWorkflowBranch(),
      commitSha: getWorkflowCommitSha(),
      details: normalizeEndpointError(error),
    }).catch(() => undefined);
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

function schedulePostSyncMaintenance(mode: SyncEndpointMode, payload: Record<string, unknown>) {
  after(async () => {
    await updateWorkflowRunState({
      workflowName: mode,
      status: "SUCCESS",
      branch: getWorkflowBranch(),
      commitSha: getWorkflowCommitSha(),
      details: buildWorkflowDetails(payload),
    }).catch((error) => {
      console.error(`Workflow status update after ${mode} sync failed.`, error);
    });
    if (mode !== "sync") {
      return;
    }

    await warmCriticalCaches().catch((error) => {
      console.error(`Cache warming after ${mode} sync failed.`, error);
    });
  });
}

function buildWorkflowDetails(payload: Record<string, unknown>) {
  const fields = [
    "mode",
    "scanned",
    "matched",
    "created",
    "updated",
    "removed",
    "sanitized",
    "enriched",
    "qualityChecked",
    "qualityImproved",
    "queued",
    "checked",
    "improved",
    "syncedAt",
  ]
    .filter((key) => key in payload)
    .map((key) => `${key}=${String(payload[key])}`);

  return fields.join(", ").slice(0, 480);
}

function getWorkflowBranch() {
  return process.env.VERCEL_GIT_COMMIT_REF || process.env.VERCEL_ENV || null;
}

function getWorkflowCommitSha() {
  return process.env.VERCEL_GIT_COMMIT_SHA || null;
}

function normalizeEndpointError(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 480) : "sync endpoint failed";
}
