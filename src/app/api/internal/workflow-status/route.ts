import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequiredCronSecret, isValidRequestSecret, readRequestSecret } from "@/lib/admin-auth";
import { updateWorkflowRunState } from "@/lib/analytics";

const workflowStatusSchema = z.object({
  workflowName: z.string().min(1).max(120),
  status: z.enum(["SUCCESS", "FAILURE", "RUNNING", "CANCELLED"]),
  runUrl: z.string().max(500).optional().nullable(),
  branch: z.string().max(120).optional().nullable(),
  commitSha: z.string().max(80).optional().nullable(),
  details: z.string().max(500).optional().nullable(),
  completedAt: z.string().datetime().optional().nullable(),
});

export async function POST(request: Request) {
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

  const body = workflowStatusSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid workflow status payload." }, { status: 400 });
  }

  try {
    await updateWorkflowRunState({
      ...body.data,
      completedAt: body.data.completedAt ? new Date(body.data.completedAt) : new Date(),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Workflow status update failed.", error);
    return NextResponse.json({ error: "Workflow status update failed." }, { status: 500 });
  }
}
