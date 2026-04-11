import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { runQualityEnrichmentCycle, syncIndieheadsReleases } from "@/lib/sync-releases";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const authorizationHeader = request.headers.get("authorization");
  const bearerSecret =
    authorizationHeader?.startsWith("Bearer ")
      ? authorizationHeader.slice("Bearer ".length)
      : null;
  const secret =
    bearerSecret ||
    searchParams.get("secret") ||
    request.headers.get("x-cron-secret");

  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wantsQualityOnly =
    searchParams.get("quality") === "1" || searchParams.get("deep") === "1";
  const wantsEnrichment = searchParams.get("enrich") === "1";

  if (wantsQualityOnly) {
    const limit = clampQualityLimit(searchParams.get("limit"));
    const result = await runQualityEnrichmentCycle(limit);
    revalidatePath("/");

    return NextResponse.json({
      ok: true,
      mode: "quality",
      ...result,
      syncedAt: new Date().toISOString(),
    });
  }

  const result = await syncIndieheadsReleases({
    enrich: wantsEnrichment,
    lightweight: !wantsEnrichment,
  });
  revalidatePath("/");

  return NextResponse.json({
    ok: true,
    ...result,
    syncedAt: new Date().toISOString(),
  });
}

function clampQualityLimit(value: string | null) {
  const parsed = Number.parseInt(value || "", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 6;
  }

  return Math.min(parsed, 12);
}
