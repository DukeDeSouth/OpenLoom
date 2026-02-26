import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiHandler } from "@/lib/api-handler";

export const GET = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const codes = await prisma.inviteCode.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(codes);
});

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const count = Math.min(Math.max(parseInt(body.count) || 1, 1), 50);

  const data = Array.from({ length: count }, () => ({}));
  await prisma.inviteCode.createMany({ data });

  const codes = await prisma.inviteCode.findMany({
    orderBy: { createdAt: "desc" },
    take: count,
  });

  return NextResponse.json(codes, { status: 201 });
});
