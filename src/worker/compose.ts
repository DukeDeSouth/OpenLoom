import { execFile } from "child_process";
import { promisify } from "util";
import { createWriteStream } from "fs";
import { unlink, mkdtemp, stat } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { getObject, putObjectFromFile } from "../lib/s3";
import { prisma } from "../lib/db";

const exec = promisify(execFile);

async function downloadFromS3(key: string, destPath: string) {
  const obj = await getObject(key);
  const body = obj.Body as Readable;
  await pipeline(body, createWriteStream(destPath));
}

export async function composeVideo(
  videoId: string,
): Promise<{ outputKey: string; duration: number }> {
  const video = await prisma.video.findUniqueOrThrow({
    where: { id: videoId },
  });

  const workDir = await mkdtemp(join(tmpdir(), "openloom-compose-"));
  const screenPath = join(workDir, "screen.webm");
  const outputPath = join(workDir, "output.mp4");

  const hasCamera = !!video.cameraKey;
  const hasMic = !!video.micKey;
  const cameraPath = hasCamera ? join(workDir, "camera.webm") : null;
  const micPath = hasMic ? join(workDir, "mic.webm") : null;

  try {
    await downloadFromS3(video.screenKey!, screenPath);
    if (hasCamera && cameraPath) {
      await downloadFromS3(video.cameraKey!, cameraPath);
    }
    if (hasMic && micPath) {
      await downloadFromS3(video.micKey!, micPath);
    }

    const screenSize = (await stat(screenPath)).size;
    const cameraSize = cameraPath ? (await stat(cameraPath)).size : 0;
    const micSize = micPath ? (await stat(micPath)).size : 0;
    console.log(`[compose] ${videoId} inputs: screen=${screenSize}b camera=${cameraSize}b mic=${micSize}b`);
    console.log(`[compose] ${videoId} hasCamera=${hasCamera} hasMic=${hasMic} micKey=${video.micKey}`);

    const commonArgs = [
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-c:a", "aac",
      "-movflags", "+faststart",
      "-y", outputPath,
    ];

    let ffmpegArgs: string[];

    if (hasCamera && hasMic) {
      ffmpegArgs = [
        "-i", screenPath,
        "-i", cameraPath!,
        "-i", micPath!,
        "-filter_complex",
        "[1:v]scale=240:-1,format=yuva420p,colorchannelmixer=aa=0.9[cam];" +
          "[0:v][cam]overlay=W-w-20:H-h-20[out]",
        "-map", "[out]",
        "-map", "2:a",
        ...commonArgs,
      ];
    } else if (hasCamera && !hasMic) {
      ffmpegArgs = [
        "-i", screenPath,
        "-i", cameraPath!,
        "-filter_complex",
        "[1:v]scale=240:-1,format=yuva420p,colorchannelmixer=aa=0.9[cam];" +
          "[0:v][cam]overlay=W-w-20:H-h-20[out]",
        "-map", "[out]",
        "-map", "0:a?",
        ...commonArgs,
      ];
    } else if (!hasCamera && hasMic) {
      ffmpegArgs = [
        "-i", screenPath,
        "-i", micPath!,
        "-map", "0:v",
        "-map", "1:a",
        ...commonArgs,
      ];
    } else {
      ffmpegArgs = [
        "-i", screenPath,
        ...commonArgs,
      ];
    }

    console.log(`[compose] ${videoId} ffmpeg args:`, ffmpegArgs.join(" "));
    const { stderr } = await exec("ffmpeg", ffmpegArgs, { timeout: 600_000 });
    if (stderr) {
      const lines = stderr.split("\n").filter(l =>
        l.includes("Stream mapping") || l.includes("Stream #") || l.includes("Error") || l.includes("audio:") || l.includes("video:")
      );
      console.log(`[compose] ${videoId} ffmpeg key lines:\n${lines.join("\n")}`);
    }

    const probe = await exec("ffprobe", [
      "-v", "quiet", "-print_format", "json", "-show_streams", "-show_format", outputPath,
    ]);
    const probeData = JSON.parse(probe.stdout);
    const audioStreams = probeData.streams.filter((s: { codec_type: string }) => s.codec_type === "audio");
    const videoStreams = probeData.streams.filter((s: { codec_type: string }) => s.codec_type === "video");
    const duration = Math.round(parseFloat(probeData.format?.duration ?? "0"));
    console.log(`[compose] ${videoId} output: ${videoStreams.length} video, ${audioStreams.length} audio streams, ${duration}s`);

    if (hasMic && audioStreams.length === 0) {
      throw new Error(`[compose] FATAL: hasMic=true but output.mp4 has 0 audio streams. micKey=${video.micKey}, micSize=${micSize}b`);
    }

    const outputSize = (await stat(outputPath)).size;
    console.log(`[compose] ${videoId} output size: ${outputSize}b`);

    const outputKey = `videos/${videoId}/output.mp4`;
    await putObjectFromFile(outputKey, outputPath, "video/mp4");

    return { outputKey, duration };
  } finally {
    await Promise.allSettled([
      unlink(screenPath),
      cameraPath ? unlink(cameraPath) : Promise.resolve(),
      micPath ? unlink(micPath) : Promise.resolve(),
      unlink(outputPath),
    ]);
  }
}
