import { NextRequest, NextResponse } from "next/server";
import { verifyJwt } from "@/lib/auth";

const PROTECTED_PATHS = ["/dashboard", "/api/videos", "/api/upload", "/api/invite-codes", "/api/keys", "/api/sections"];
const PUBLIC_API = ["/api/auth", "/api/health", "/api/ping", "/api/access"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  const isPublicApi = PUBLIC_API.some((p) => pathname.startsWith(p));

  if (!isProtected || isPublicApi) return NextResponse.next();

  if (req.method === "GET") {
    if (pathname.match(/^\/api\/videos\/[^/]+$/)) return NextResponse.next();
    if (pathname === "/api/sections" || pathname.match(/^\/api\/sections\/[^/]+$/)) return NextResponse.next();
    if (pathname === "/api/channel") return NextResponse.next();
  }

  const token = req.cookies.get("openloom_token")?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const payload = await verifyJwt(token);
  if (!payload) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const headers = new Headers(req.headers);
  headers.set("x-user-id", payload.userId);
  headers.set("x-user-email", payload.email);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/videos/:path*", "/api/upload/:path*", "/api/sections/:path*", "/api/channel", "/api/invite-codes/:path*", "/api/keys/:path*"],
};
