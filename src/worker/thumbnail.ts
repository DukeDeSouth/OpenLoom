import { execFile } from "child_process";
import { promisify } from "util";
import { createWriteStream } from "fs";
import { unlink, mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { prisma } from "../lib/db";
import { getObject, putObjectFromFile } from "../lib/s3";

const exec = promisify(execFile);

export async function generateThumbnail(
  videoId: string,
  mp4Key: string,
): Promise<void> {
  const workDir = await mkdtemp(join(tmpdir(), "openloom-thumb-"));
  const mp4Path = join(workDir, "input.mp4");
  const thumbPath = join(workDir, "thumb.jpg");

  try {
    const obj = await getObject(mp4Key);
    await pipeline(obj.Body as Readable, createWriteStream(mp4Path));

    await exec(
      "ffmpeg",
      [
        "-i", mp4Path,
        "-ss", "00:00:01",
        "-frames:v", "1",
        "-vf", "scale=640:360:force_original_aspect_ratio=decrease",
        "-q:v", "2",
        "-y", thumbPath,
      ],
      { timeout: 30_000 },
    );

    const thumbKey = `videos/${videoId}/thumb.jpg`;
    await putObjectFromFile(thumbKey, thumbPath, "image/jpeg");

    await prisma.video.update({
      where: { id: videoId },
      data: { thumbKey },
    });
  } finally {
    await Promise.allSettled([unlink(mp4Path), unlink(thumbPath)]);
  }
}
