import {
  S3Client,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { config } from "../config";

const s3 = new S3Client({
  endpoint:       config.s3Endpoint,
  region:         config.s3Region,
  credentials: {
    accessKeyId:     config.s3AccessKey,
    secretAccessKey: config.s3SecretKey,
  },
  forcePathStyle: true,
});

/**
 * Скачивает blob по точному s3_key из события Kafka.
 */
export async function downloadBlob(s3Key: string): Promise<Uint8Array> {
  const res = await s3.send(new GetObjectCommand({
    Bucket: config.s3Bucket,
    Key:    s3Key,
  }));

  const stream = res.Body as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  }
  return new Uint8Array(Buffer.concat(chunks));
}
