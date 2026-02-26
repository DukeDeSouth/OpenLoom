import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiHandler } from "@/lib/api-handler";

export const GET = apiHandler(async () => {
  const sections = await prisma.section.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { videos: { where: { status: "READY" } } } } },
  });
  return NextResponse.json(sections);
});

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }

  const maxOrder = await prisma.section.aggregate({ _max: { order: true } });
  const section = await prisma.section.create({
    data: {
      title: title.slice(0, 200),
      description: typeof body.description === "string" ? body.description.trim().slice(0, 1000) || null : null,
      visibility: body.visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC",
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  return NextResponse.json(section, { status: 201 });
});
