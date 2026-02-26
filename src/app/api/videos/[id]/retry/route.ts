import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { addProcessingJob } from "@/lib/queue";
import { apiHandler } from "@/lib/api-handler";

export const POST = apiHandler(async (req: NextRequest, ctx) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const video = await prisma.video.findFirst({
    where: { id, userId, status: { in: ["PROCESSING", "FAILED"] } },
  });

  if (!video) {
    return NextResponse.json(
      { error: "Video not found or not eligible for retry" },
      { status: 404 },
    );
  }

  await prisma.video.update({
    where: { id },
    data: { status: "PROCESSING" },
  });

  await addProcessingJob(id);

  return NextResponse.json({ ok: true, status: "PROCESSING" });
});
