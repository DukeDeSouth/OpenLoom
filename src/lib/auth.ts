import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { getEncodedSecret } from "@/lib/secret";

export const COOKIE_NAME = "openloom_token";

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: (process.env.BASE_URL ?? "").startsWith("https://"),
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 7,
  path: "/",
};

interface UserPayload {
  userId: string;
  email: string;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function signJwt(payload: UserPayload): Promise<string> {
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getEncodedSecret());
}

export async function verifyJwt(token: string): Promise<UserPayload | null> {
  const secret = getEncodedSecret();
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as UserPayload;
  } catch {
    return null;
  }
}

export async function getSession(
  req?: NextRequest,
): Promise<UserPayload | null> {
  let token: string | undefined;

  if (req) {
    token = req.cookies.get(COOKIE_NAME)?.value;
  } else {
    const cookieStore = await cookies();
    token = cookieStore.get(COOKIE_NAME)?.value;
  }

  if (!token) return null;
  return verifyJwt(token);
}
