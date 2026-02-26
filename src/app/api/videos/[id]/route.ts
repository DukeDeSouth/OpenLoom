import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deleteObject } from "@/lib/s3";
import { apiHandler } from "@/lib/api-handler";

export const GET = apiHandler(async (_req: NextRequest, ctx) => {
  const { id } = await ctx.params;

  const video = await prisma.video.findUnique({
    where: { id },
    include: {
      segments: { orderBy: { start: "asc" } },
      user: { select: { name: true } },
    },
  });

  if (!video) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.video.update({
    where: { id },
    data: { views: { increment: 1 } },
  });

  return NextResponse.json(video);
});

export const PATCH = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json();

  const video = await prisma.video.findFirst({ where: { id, userId } });
  if (!video) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) {
    data.title = body.title.trim().slice(0, 200);
  }
  if ("sectionId" in body) {
    data.sectionId = body.sectionId || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await prisma.video.update({ where: { id }, data });

  return NextResponse.json({ ok: true, ...data });
});

export const DELETE = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const video = await prisma.video.findFirst({
    where: { id, userId },
  });

  if (!video) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const keysToDelete = [
    video.screenKey,
    video.cameraKey,
    video.outputKey,
    video.thumbKey,
    video.subtitleKey,
  ].filter(Boolean) as string[];

  await Promise.allSettled(keysToDelete.map((key) => deleteObject(key)));
  await prisma.video.delete({ where: { id } });

  return NextResponse.json({ ok: true });
});
