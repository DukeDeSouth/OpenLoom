import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { s3, BUCKET } from "@/lib/s3";
import { redis } from "@/lib/redis";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
type ServiceStatus = { status: "up" } | { status: "down"; error: string };

async function checkDb(): Promise<ServiceStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "up" };
  } catch {
    return { status: "down", error: "Service unavailable" };
  }
}

async function checkS3(): Promise<ServiceStatus> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
    return { status: "up" };
  } catch {
    return { status: "down", error: "Service unavailable" };
  }
}

async function checkRedis(): Promise<ServiceStatus> {
  try {
    const pong = await redis.ping();
    if (pong !== "PONG") throw new Error("unexpected response");
    return { status: "up" };
  } catch {
    return { status: "down", error: "Service unavailable" };
  }
}

async function checkWorker(): Promise<ServiceStatus> {
  try {
    const heartbeat = await redis.get("openloom:worker:heartbeat");
    if (!heartbeat) {
      return { status: "down", error: "Service unavailable" };
    }
    const age = Date.now() - parseInt(heartbeat, 10);
    if (age > 30_000) {
      return { status: "down", error: "Service unavailable" };
    }
    return { status: "up" };
  } catch {
    return { status: "down", error: "Service unavailable" };
  }
}

export async function GET() {
  const [db, s3Status, redisStatus, workerStatus] =
    await Promise.all([
      checkDb(),
      checkS3(),
      checkRedis(),
      checkWorker(),
    ]);

  const services = {
    db,
    s3: s3Status,
    redis: redisStatus,
    worker: workerStatus,
  };
  const ok = Object.values(services).every((s) => s.status === "up");

  return NextResponse.json(
    { ok, services },
    { status: ok ? 200 : 503 },
  );
}
