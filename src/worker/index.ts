import { Worker, Job } from "bullmq";
import { redis } from "../lib/redis";
import { prisma } from "../lib/db";
import { composeVideo } from "./compose";
import { transcribeVideo } from "./transcribe";
import { generateThumbnail } from "./thumbnail";

const ENABLE_TRANSCRIPTION = process.env.DISABLE_TRANSCRIPTION !== "true";

const worker = new Worker(
  "video-processing",
  async (job: Job<{ videoId: string }>) => {
    const { videoId } = job.data;
    console.log(`[worker] Processing video ${videoId}`);

    try {
      // Step 1: Compose (screen + camera → mp4)
      await prisma.video.update({
        where: { id: videoId },
        data: { status: "PROCESSING" },
      });

      const { outputKey, duration } = await composeVideo(videoId);
      console.log(`[worker] Composed: ${outputKey} (${duration}s)`);

      // Step 2: Generate thumbnail
      await generateThumbnail(videoId, outputKey);
      console.log(`[worker] Thumbnail generated`);

      // Mark as READY — video is watchable now
      await prisma.video.update({
        where: { id: videoId },
        data: { outputKey, duration, status: "READY" },
      });
      console.log(`[worker] Video ${videoId} is READY`);

      // Step 3: Transcription (async bonus, doesn't block playback)
      if (ENABLE_TRANSCRIPTION) {
        try {
          await transcribeVideo(videoId, outputKey);
          console.log(`[worker] Transcription complete for ${videoId}`);
        } catch (err) {
          console.error(`[worker] Transcription failed (non-fatal):`, err);
        }
      }
    } catch (err) {
      console.error(`[worker] Video ${videoId} failed:`, err);
      await prisma.video.update({
        where: { id: videoId },
        data: { status: "FAILED" },
      });
      throw err;
    }
  },
  {
    connection: redis,
    concurrency: 2,
  },
);

worker.on("completed", (job) =>
  console.log(`[worker] Job ${job.id} completed`),
);
worker.on("failed", (job, err) =>
  console.error(`[worker] Job ${job?.id} failed:`, err.message),
);

const HEARTBEAT_KEY = "openloom:worker:heartbeat";
const HEARTBEAT_INTERVAL = 5_000;

async function sendHeartbeat() {
  try {
    await redis.set(HEARTBEAT_KEY, Date.now().toString(), "EX", 15);
  } catch (e) {
    console.error("[worker] heartbeat failed:", e);
  }
}
sendHeartbeat();
setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

console.log(`[worker] Started PID=${process.pid}, waiting for jobs...`);
