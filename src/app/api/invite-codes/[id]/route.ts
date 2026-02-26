import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiHandler } from "@/lib/api-handler";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  await prisma.inviteCode.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
