import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiHandler } from "@/lib/api-handler";
import { getObjectUrl } from "@/lib/s3";

export const GET = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const videos = await prisma.video.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      duration: true,
      thumbKey: true,
      views: true,
      sectionId: true,
      createdAt: true,
    },
  });

  const mapped = videos.map((v) => ({
    ...v,
    thumbUrl: v.thumbKey ? getObjectUrl(v.thumbKey) : null,
  }));

  return NextResponse.json(mapped);
});

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title } = await req.json();

  const video = await prisma.video.create({
    data: {
      title: title || `Recording ${new Date().toLocaleString()}`,
      userId,
    },
  });

  return NextResponse.json({ id: video.id }, { status: 201 });
});
