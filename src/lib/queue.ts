import { Queue } from "bullmq";
import { redis } from "./redis";

export const videoQueue = new Queue("video-processing", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export async function addProcessingJob(videoId: string) {
  return videoQueue.add("process", { videoId }, { jobId: `video-${videoId}` });
}
