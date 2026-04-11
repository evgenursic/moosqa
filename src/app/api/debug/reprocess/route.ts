import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { runWeakCardReprocess } from "@/lib/sync-releases";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const authorizationHeader = request.headers.get("authorization");
  const bearerSecret =
    authorizationHeader?.startsWith("Bearer ")
      ? authorizationHeader.slice("Bearer ".length)
      : null;
  const secret =
    bearerSecret ||
    searchParams.get("secret") ||
    request.headers.get("x-debug-secret");
  const allowedSecret = process.env.DEBUG_SECRET || process.env.CRON_SECRET;

  if (!allowedSecret || secret !== allowedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = clampReprocessLimit(searchParams.get("limit"));
  const result = await runWeakCardReprocess(limit);

  revalidatePath("/");
  revalidatePath("/debug");
  revalidateTag("releases", "max");

  return NextResponse.json({
    ok: true,
    mode: "manual-reprocess",
    ...result,
    processedAt: new Date().toISOString(),
  });
}

function clampReprocessLimit(value: string | null) {
  const parsed = Number.parseInt(value || "", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 12;
  }

  return Math.min(parsed, 24);
}
