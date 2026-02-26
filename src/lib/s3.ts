import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { readFile } from "fs/promises";

const credentials = {
  accessKeyId: process.env.S3_ACCESS_KEY || "minioadmin",
  secretAccessKey: process.env.S3_SECRET_KEY || "minioadmin",
};

export const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT || "http://minio:9000",
  region: "us-east-1",
  credentials,
  forcePathStyle: true,
});

const publicEndpoint = process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT || "http://localhost:9000";

const s3Public = new S3Client({
  endpoint: publicEndpoint,
  region: "us-east-1",
  credentials,
  forcePathStyle: true,
});

export const BUCKET = process.env.S3_BUCKET || "openloom";

export async function getPresignedPutUrl(
  key: string,
  contentType: string,
  expiresIn = 300,
) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3Public, command, { expiresIn });
}

export async function getObject(key: string) {
  return s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
}

export async function deleteObject(key: string) {
  return s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export function getObjectUrl(key: string) {
  return `${publicEndpoint}/${BUCKET}/${key}`;
}

export async function putObjectFromFile(
  key: string,
  filePath: string,
  contentType: string,
) {
  const body = await readFile(filePath);
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function putObjectFromBuffer(
  key: string,
  body: Buffer,
  contentType: string,
) {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}
