import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, unlink, mkdtemp } from "fs/promises";
import { createWriteStream } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { prisma } from "../lib/db";
import { getObject, putObjectFromBuffer } from "../lib/s3";

const exec = promisify(execFile);
const WHISPER_MODEL = process.env.WHISPER_MODEL || "base";
const WHISPER_BIN = process.env.WHISPER_BIN || "/usr/local/bin/whisper-cpp";
const MODELS_DIR = process.env.WHISPER_MODELS_DIR || "/models";

interface WhisperSegment {
  start: number;
  end: number;
  text: string;
}

function parseTimestamp(ts: string): number {
  const parts = ts.split(":");
  if (parts.length === 3) {
    const [h, m, rest] = parts;
    const [s, ms] = rest.split(".");
    return (
      parseInt(h) * 3600 +
      parseInt(m) * 60 +
      parseInt(s) +
      (ms ? parseInt(ms) / 1000 : 0)
    );
  }
  return 0;
}

function formatVTTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  const ms = Math.floor((seconds % 1) * 1000)
    .toString()
    .padStart(3, "0");
  return `${h}:${m}:${s}.${ms}`;
}

function generateVTT(segments: WhisperSegment[]): string {
  let vtt = "WEBVTT\n\n";
  for (const seg of segments) {
    vtt += `${formatVTTTime(seg.start)} --> ${formatVTTTime(seg.end)}\n`;
    vtt += `${seg.text}\n\n`;
  }
  return vtt;
}

export async function transcribeVideo(
  videoId: string,
  mp4Key: string,
): Promise<void> {
  const workDir = await mkdtemp(join(tmpdir(), "openloom-whisper-"));
  const mp4Path = join(workDir, "input.mp4");
  const wavPath = join(workDir, "audio.wav");
  const outputBase = join(workDir, "output");

  try {
    const obj = await getObject(mp4Key);
    await pipeline(obj.Body as Readable, createWriteStream(mp4Path));

    // Extract 16kHz mono WAV
    await exec(
      "ffmpeg",
      [
        "-i", mp4Path,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        "-y", wavPath,
      ],
      { timeout: 120_000 },
    );

    // Run whisper
    await exec(
      WHISPER_BIN,
      [
        "-m", join(MODELS_DIR, `ggml-${WHISPER_MODEL}.bin`),
        "-f", wavPath,
        "-oj",
        "-of", outputBase,
        "-l", "auto",
      ],
      { timeout: 600_000 },
    );

    const jsonPath = `${outputBase}.json`;
    const raw = JSON.parse(await readFile(jsonPath, "utf-8"));

    const segments: WhisperSegment[] = raw.transcription.map(
      (s: { timestamps: { from: string; to: string }; text: string }) => ({
        start: parseTimestamp(s.timestamps.from),
        end: parseTimestamp(s.timestamps.to),
        text: s.text.trim(),
      }),
    );

    const vtt = generateVTT(segments);
    const vttKey = `videos/${videoId}/subtitles.vtt`;
    await putObjectFromBuffer(vttKey, Buffer.from(vtt), "text/vtt");

    await prisma.$transaction([
      prisma.segment.createMany({
        data: segments.map((s) => ({
          videoId,
          start: s.start,
          end: s.end,
          text: s.text,
        })),
      }),
      prisma.video.update({
        where: { id: videoId },
        data: { subtitleKey: vttKey },
      }),
    ]);
  } finally {
    await Promise.allSettled([
      unlink(mp4Path),
      unlink(wavPath),
      unlink(`${outputBase}.json`).catch(() => {}),
    ]);
  }
}
