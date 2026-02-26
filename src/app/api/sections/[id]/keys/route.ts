import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiHandler } from "@/lib/api-handler";

type Ctx = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const keys = await prisma.accessKey.findMany({
    where: { sectionId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(keys);
});

export const POST = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json();
  const type = body.type === "SINGLE_USE" ? "SINGLE_USE" : "PERMANENT";
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 100) || null : null;

  const section = await prisma.section.findUnique({ where: { id } });
  if (!section) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  const key = await prisma.accessKey.create({
    data: { sectionId: id, type, label },
  });

  return NextResponse.json(key, { status: 201 });
});
