import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { comparePassword, signJwt, COOKIE_NAME, COOKIE_OPTIONS } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
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
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
