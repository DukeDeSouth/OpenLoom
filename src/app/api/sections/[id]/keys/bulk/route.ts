import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiHandler } from "@/lib/api-handler";

type Ctx = { params: Promise<{ id: string }> };

export const POST = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json();
  const count = Math.min(Math.max(parseInt(body.count) || 1, 1), 100);
  const type = body.type === "SINGLE_USE" ? "SINGLE_USE" : "PERMANENT";
  const labelPrefix = typeof body.labelPrefix === "string" ? body.labelPrefix.trim().slice(0, 80) : "";

  const section = await prisma.section.findUnique({ where: { id } });
  if (!section) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  const data = Array.from({ length: count }, (_, i) => ({
    sectionId: id,
    type: type as "PERMANENT" | "SINGLE_USE",
    label: labelPrefix ? `${labelPrefix} #${i + 1}` : null,
  }));

  const result = await prisma.accessKey.createMany({ data });

  const keys = await prisma.accessKey.findMany({
    where: { sectionId: id },
    orderBy: { createdAt: "desc" },
    take: count,
  });

  return NextResponse.json({ created: result.count, keys }, { status: 201 });
});
