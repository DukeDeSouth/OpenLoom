import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiHandler } from "@/lib/api-handler";

export const GET = apiHandler(async () => {
  const channel = await prisma.channel.upsert({
    where: { id: "default" },
    create: { id: "default", title: "My Channel" },
    update: {},
  });
  return NextResponse.json(channel);
});

export const PATCH = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const data: Record<string, string> = {};
  if (typeof body.title === "string" && body.title.trim()) {
    data.title = body.title.trim().slice(0, 200);
  }
  if (typeof body.description === "string") {
    data.description = body.description.trim().slice(0, 1000) || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const channel = await prisma.channel.upsert({
    where: { id: "default" },
    create: { id: "default", ...data },
    update: data,
  });

  return NextResponse.json(channel);
});
