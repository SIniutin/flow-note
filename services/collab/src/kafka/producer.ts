/**
 * Kafka producer для collab-service.
 * Публикует событие page.snapshot.uploaded после успешной загрузки blob в S3.
 *
 * Инициализация lazy — подключается при первой отправке сообщения,
 * чтобы не блокировать старт если Kafka ещё не поднялась.
 */

import { Kafka, Producer, CompressionTypes } from "kafkajs";
import { config } from "../config";

export interface SnapshotUploadedEvent {
  page_id:    string;
  s3_key:     string;
  size_bytes: number;
  ts:         number; // unix ms
}

const kafka = new Kafka({
  clientId: config.kafkaClientId,
  brokers:  config.kafkaBrokers.split(","),
  // Retry при старте — Kafka может подниматься дольше collab-service
  retry: {
    initialRetryTime: 300,
    retries:          10,
  },
});

let producer: Producer | null = null;
let connecting = false;
let connectPromise: Promise<void> | null = null;

async function getProducer(): Promise<Producer> {
  if (producer) return producer;

  if (connecting && connectPromise) {
    await connectPromise;
    return producer!;
  }

  connecting = true;
  const p = kafka.producer({
    allowAutoTopicCreation: true, // создаёт топик если не существует
  });

  connectPromise = p.connect();
  await connectPromise;

  producer = p;
  connecting = false;
  console.log("[kafka] producer connected");
  return producer;
}

/**
 * Публикует событие о загруженном snapshot в Kafka.
 * При ошибке — логирует warn (blob уже в S3, потеря события не критична).
 */
export async function publishSnapshotUploaded(
  pageId:    string,
  s3Key:     string,
  sizeBytes: number
): Promise<void> {
  const event: SnapshotUploadedEvent = {
    page_id:    pageId,
    s3_key:     s3Key,
    size_bytes: sizeBytes,
    ts:         Date.now(),
  };

  const p = await getProducer();
  await p.send({
    topic:       config.kafkaTopic,
    compression: CompressionTypes.GZIP,
    messages: [{
      key:   pageId,        // ключ = page_id для партиционирования
      value: JSON.stringify(event),
    }],
  });

  console.log(`[kafka] published snapshot.uploaded  page=${pageId}  key=${s3Key}  bytes=${sizeBytes}`);
}

/**
 * Graceful shutdown — вызывается из process shutdown handler.
 */
export async function disconnectProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
    console.log("[kafka] producer disconnected");
  }
}
