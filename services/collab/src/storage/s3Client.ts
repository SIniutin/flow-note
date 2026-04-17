/**
 * S3 / MinIO клиент для хранения Y.Doc snapshot'ов.
 *
 * Ключ объекта: snapshots/{pageId}/{timestamp}.bin
 * Последний snapshot определяется по лексикографически максимальному ключу
 * (timestamp в имени файла обеспечивает правильный порядок).
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  PutBucketLifecycleConfigurationCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { config } from "../config";

const s3 = new S3Client({
  endpoint:        config.s3Endpoint,
  region:          config.s3Region,
  credentials: {
    accessKeyId:     config.s3AccessKey,
    secretAccessKey: config.s3SecretKey,
  },
  // MinIO требует path-style (bucket в path, не в hostname)
  forcePathStyle: true,
});

/**
 * Загружает blob в S3 и возвращает s3_key.
 * Основной ключ: snapshots/{pageId}/{Date.now()}.bin
 * Дополнительно обновляет стабильный alias:
 *   snapshots/{pageId}/latest.bin
 */
export async function uploadSnapshot(pageId: string, blob: Uint8Array): Promise<string> {
  const key = `snapshots/${pageId}/${Date.now()}.bin`;
  const latestKey = `snapshots/${pageId}/latest.bin`;

  await s3.send(new PutObjectCommand({
    Bucket:      config.s3Bucket,
    Key:         key,
    Body:        Buffer.from(blob),
    ContentType: "application/octet-stream",
  }));

  await s3.send(new CopyObjectCommand({
    Bucket:     config.s3Bucket,
    Key:        latestKey,
    CopySource: `/${config.s3Bucket}/${key}`,
    MetadataDirective: "COPY",
  }));

  return key;
}

/**
 * Скачивает snapshot по точному s3_key (хранится в Redis после каждого flush).
 * Возвращает null если ключ не найден в S3 (новая страница или ключ ещё не записан).
 */
export async function downloadByKey(s3Key: string): Promise<Uint8Array | null> {
  try {
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
  } catch (err: unknown) {
    // NoSuchKey — нормальная ситуация (страница удалена или ключ устарел)
    if ((err as { name?: string }).name === "NoSuchKey") return null;
    throw err;
  }
}

/**
 * Устанавливает lifecycle policy на бакет.
 * Standard → Standard-IA (30д) → Glacier (90д) → Glacier Deep Archive (180д).
 * На MinIO storage-class transitions не поддерживаются — логируем warn и продолжаем.
 * Вызывается один раз при старте.
 */
export async function ensureBucketLifecycle(): Promise<void> {
  try {
    await s3.send(new PutBucketLifecycleConfigurationCommand({
      Bucket: config.s3Bucket,
      LifecycleConfiguration: {
        Rules: [{
          ID:     "snapshot-tiering",
          Status: "Enabled",
          Filter: { Prefix: "snapshots/" },
          Transitions: [
            { Days: 30,  StorageClass: "STANDARD_IA"   },
            { Days: 90,  StorageClass: "GLACIER"        },
            { Days: 180, StorageClass: "DEEP_ARCHIVE"   },
          ],
        }],
      },
    }));
    console.log("[s3] lifecycle policy applied");
  } catch (err) {
    // MinIO не поддерживает storage class transitions — не фатально
    console.warn("[s3] lifecycle policy skipped:", (err as Error).message);
  }
}
