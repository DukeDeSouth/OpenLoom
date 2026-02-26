import { NextRequest, NextResponse } from "next/server";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Handler = (req: NextRequest, ctx: any) => Promise<NextResponse>;

export type ApiErrorCode = "DB_UNREACHABLE" | "UNAUTHORIZED" | "INTERNAL";

export function apiHandler(fn: Handler): Handler {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      console.error(`[api] ${req.method} ${req.nextUrl.pathname}:`, message);

      const isDbError =
        message.includes("Can't reach database") ||
        message.includes("P1001") ||
        message.includes("P1010") ||
        message.includes("Connection refused") ||
        message.includes("ECONNREFUSED");

      if (isDbError) {
        return NextResponse.json(
          {
            error: "Database is not reachable",
            code: "DB_UNREACHABLE" satisfies ApiErrorCode,
            hint: "Run `docker compose up -d` in your OpenLoom folder to start the database.",
          },
          { status: 503 },
        );
      }

      return NextResponse.json(
        {
          error: "Something went wrong. Please try again.",
          code: "INTERNAL" satisfies ApiErrorCode,
        },
        { status: 500 },
      );
    }
  };
}
