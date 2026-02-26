import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiHandler } from "@/lib/api-handler";
import { verifyAccessToken } from "@/lib/access";
import { cookies } from "next/headers";

type Ctx = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (_req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;

  const section = await prisma.section.findUnique({
    where: { id },
    include: {
      videos: {
        where: { status: "READY" },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, thumbKey: true, duration: true, views: true, createdAt: true },
      },
      _count: { select: { accessKeys: true } },
    },
  });

  if (!section) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (section.visibility === "PRIVATE") {
    const cookieStore = await cookies();
    const accessCookie = cookieStore.get(`access_${id}`)?.value;
    if (!accessCookie) {
      return NextResponse.json({ error: "Access key required", needsKey: true }, { status: 403 });
    }
    const access = await verifyAccessToken(accessCookie);
    if (!access || access.sectionId !== id) {
      return NextResponse.json({ error: "Invalid access", needsKey: true }, { status: 403 });
    }
  }

  return NextResponse.json(section);
});

export const PATCH = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) {
    data.title = body.title.trim().slice(0, 200);
  }
  if (typeof body.description === "string") {
    data.description = body.description.trim().slice(0, 1000) || null;
  }
  if (body.visibility === "PUBLIC" || body.visibility === "PRIVATE") {
    data.visibility = body.visibility;
  }
  if (typeof body.order === "number") {
    data.order = body.order;
  }

  const section = await prisma.section.update({ where: { id }, data });
  return NextResponse.json(section);
});

export const DELETE = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  await prisma.section.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
