import { SignJWT, jwtVerify } from "jose";
import { getEncodedSecret } from "@/lib/secret";

interface AccessPayload {
  sectionId: string;
  keyId: string;
}

export async function signAccessToken(
  sectionId: string,
  keyId: string,
  type: "PERMANENT" | "SINGLE_USE",
): Promise<string> {
  const exp = type === "PERMANENT" ? "30d" : "7d";
  return new SignJWT({ sectionId, keyId } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(getEncodedSecret());
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessPayload | null> {
  const secret = getEncodedSecret();
  try {
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.sectionId !== "string" || typeof payload.keyId !== "string") {
      return null;
    }
    return { sectionId: payload.sectionId, keyId: payload.keyId };
  } catch {
    return null;
  }
}
