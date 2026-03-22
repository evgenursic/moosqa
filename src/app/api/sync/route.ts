import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { syncIndieheadsReleases } from "@/lib/sync-releases";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret") || request.headers.get("x-cron-secret");

  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncIndieheadsReleases();
  revalidatePath("/");

  return NextResponse.json({
    ok: true,
    ...result,
    syncedAt: new Date().toISOString(),
  });
}
