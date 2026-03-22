import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";

const voteSchema = z.object({
  releaseId: z.string().min(1),
  value: z.number().int().min(1).max(100),
});

export async function POST(request: Request) {
  await ensureDatabase();
  const body = voteSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const cookieStore = await cookies();
  let deviceId = cookieStore.get("moosqa_device")?.value;

  if (!deviceId) {
    deviceId = crypto.randomUUID();
  }

  const release = await prisma.release.findUnique({
    where: { id: body.data.releaseId },
    select: { id: true },
  });

  if (!release) {
    return NextResponse.json({ error: "Release not found." }, { status: 404 });
  }

  await prisma.vote.upsert({
    where: {
      releaseId_deviceId: {
        releaseId: body.data.releaseId,
        deviceId,
      },
    },
    update: {
      value: body.data.value,
    },
    create: {
      releaseId: body.data.releaseId,
      deviceId,
      value: body.data.value,
    },
  });

  const aggregate = await prisma.vote.aggregate({
    where: { releaseId: body.data.releaseId },
    _avg: { value: true },
    _count: { value: true },
  });

  await prisma.release.update({
    where: { id: body.data.releaseId },
    data: {
      scoreAverage: aggregate._avg.value ?? 0,
      scoreCount: aggregate._count.value,
    },
  });

  const response = NextResponse.json({
    ok: true,
    average: aggregate._avg.value ?? 0,
    count: aggregate._count.value,
  });

  response.cookies.set({
    name: "moosqa_device",
    value: deviceId,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
