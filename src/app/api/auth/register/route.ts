import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, signJwt, COOKIE_NAME, COOKIE_OPTIONS } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, inviteCode } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 },
      );
    }

    const userCount = await prisma.user.count();
    let inviteCodeRecord = null;

    if (userCount > 0) {
      if (!inviteCode) {
        return NextResponse.json(
          { error: "Invite code required" },
          { status: 403 },
        );
      }
      inviteCodeRecord = await prisma.inviteCode.findFirst({
        where: { code: inviteCode, usedBy: null },
      });
      if (!inviteCodeRecord) {
        return NextResponse.json(
          { error: "Invalid or already used invite code" },
          { status: 403 },
        );
      }
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 },
      );
    }

    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, password: hashed, name: name || null },
    });

    if (inviteCodeRecord) {
      await prisma.inviteCode.update({
        where: { id: inviteCodeRecord.id },
        data: { usedBy: user.id, usedAt: new Date() },
      });
    }

    const token = await signJwt({ userId: user.id, email: user.email });

    const response = NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
    });
    response.cookies.set(COOKIE_NAME, token, COOKIE_OPTIONS);
    return response;
  } catch {
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
