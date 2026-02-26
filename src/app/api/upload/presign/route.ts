import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPresignedPutUrl } from "@/lib/s3";
import { apiHandler } from "@/lib/api-handler";

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { videoId, fileType } = await req.json();

  if (!videoId || !["screen", "camera", "mic", "thumb"].includes(fileType)) {
    return NextResponse.json(
      { error: "Missing videoId or invalid fileType" },
      { status: 400 },
    );
  }

  const video = await prisma.video.findFirst({
    where: { id: videoId, userId },
  });

  if (!video) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = fileType === "thumb" ? "jpg" : "webm";
  const key = `videos/${videoId}/${fileType}.${ext}`;
  const contentType =
    fileType === "thumb"
      ? "image/jpeg"
      : fileType === "mic"
        ? "audio/webm"
        : "video/webm";

  const url = await getPresignedPutUrl(key, contentType, 300);

  const keyField =
    fileType === "screen"
      ? "screenKey"
      : fileType === "camera"
        ? "cameraKey"
        : fileType === "mic"
          ? "micKey"
          : "thumbKey";

  await prisma.video.update({
    where: { id: videoId },
    data: { [keyField]: key },
  });

  return NextResponse.json({ url, key });
});
