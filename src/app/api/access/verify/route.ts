import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signAccessToken } from "@/lib/access";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, sectionId, fingerprint } = body;

    if (!token || !sectionId) {
      return NextResponse.json({ error: "Token and sectionId required" }, { status: 400 });
    }

    const key = await prisma.accessKey.findFirst({
      where: { token, sectionId },
      include: { section: true },
    });

    if (!key) {
      return NextResponse.json({ error: "Invalid access key" }, { status: 403 });
    }

    if (key.section.visibility !== "PRIVATE") {
      return NextResponse.json({ error: "Section is public" }, { status: 400 });
    }

    if (key.type === "PERMANENT") {
      const accessToken = await signAccessToken(sectionId, key.id, "PERMANENT");
      return NextResponse.json({ ok: true, accessToken, maxAge: 30 * 24 * 3600 });
    }

    if (!fingerprint || typeof fingerprint !== "string" || fingerprint.length < 5) {
      return NextResponse.json({ error: "Device verification required" }, { status: 400 });
    }

    if (!key.fingerprint) {
      await prisma.accessKey.update({
        where: { id: key.id },
        data: { fingerprint, activatedAt: new Date() },
      });
      const accessToken = await signAccessToken(sectionId, key.id, "SINGLE_USE");
      return NextResponse.json({ ok: true, accessToken, maxAge: 7 * 24 * 3600 });
    }

    if (key.fingerprint === fingerprint) {
      const accessToken = await signAccessToken(sectionId, key.id, "SINGLE_USE");
      return NextResponse.json({ ok: true, accessToken, maxAge: 7 * 24 * 3600 });
    }

    return NextResponse.json(
      { error: "This key has already been used on another device" },
      { status: 403 },
    );
  } catch {
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
