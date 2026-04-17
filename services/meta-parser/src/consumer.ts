/**
 * Kafka consumer для meta-parser.
 *
 * Горизонтальное масштабирование:
 *   - Несколько инстансов meta-parser в одном consumer group → Kafka раздаёт партиции между ними.
 *   - Кол-во партиций топика должно быть ≥ max ожидаемых инстансов (задаётся в Kafka конфиге).
 *
 * Гарантии доставки:
 *   - at-least-once: eachMessage делает await processEvent, offset коммитится только после успеха.
 *   - Если инстанс падает во время обработки → сообщение перечитывается после рестарта/rebalance.
 *   - Идемпотентность на стороне pages-service желательна (replace с тем же snapshot — безвреден).
 *
 * Внутренний параллелизм одного инстанса:
 *   - partitionsConsumedConcurrently = WORKER_CONCURRENCY (default 4).
 *   - Партиции внутри инстанса обрабатываются параллельно; порядок внутри одной партиции сохранён.
 *   - Одна партиция = один page_id (ключ сообщения = page_id) → обновления одной страницы строго упорядочены.
 */

import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { config }          from "./config";
import { downloadBlob }    from "./storage/s3Client";
import { parseSnapshot }   from "./parser/ydocParser";
import { replacePageRelations }  from "./grpc/pagesClient";
import { sendToDlq }       from "./kafka/dlqProducer";

interface SnapshotUploadedEvent {
  page_id:    string;
  s3_key:     string;
  size_bytes: number;
  ts:         number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function processEvent(event: SnapshotUploadedEvent): Promise<void> {
  const { page_id, s3_key } = event;

  if (!UUID_RE.test(page_id)) {
    console.warn(`[worker] skip  page="${page_id}" — not a valid UUID`);
    return;
  }

  console.log(`[worker] processing  page=${page_id}  s3_key=${s3_key}`);

  const blob = await downloadBlob(s3_key);
  console.log(`[worker] downloaded  page=${page_id}  bytes=${blob.byteLength}`);

  const meta = parseSnapshot(blob);
  console.log(
    `[worker] parsed  page=${page_id}  title="${meta.title}"  words=${meta.wordCount}  links=${meta.links.length}  mentions=${meta.mentions.length}  tables=[${meta.tables.map((table) => table.dstId).join(", ")}]`
  );

  await replacePageRelations(page_id, meta, {
    sizeBytes: event.size_bytes,
    snapshotKey: s3_key,
  });
  console.log(`[worker] ReplacePageRelations OK  page=${page_id}`);
}

const MAX_PROCESS_ATTEMPTS  = 3;
const RETRY_BASE_DELAY_MS   = 1_000;

async function processWithRetry(event: SnapshotUploadedEvent): Promise<void> {
  for (let attempt = 1; attempt <= MAX_PROCESS_ATTEMPTS; attempt++) {
    try {
      await processEvent(event);
      return;
    } catch (err) {
      console.error(
        `[consumer] attempt ${attempt}/${MAX_PROCESS_ATTEMPTS} failed  page=${event.page_id}:`,
        (err as Error).message,
      );

      if (attempt === MAX_PROCESS_ATTEMPTS) {
        // Исчерпали попытки → DLQ; не бросаем исключение чтобы offset закоммитился
        await sendToDlq(event, err as Error).catch((dlqErr: unknown) =>
          console.error("[consumer] DLQ send failed:", (dlqErr as Error).message)
        );
        return;
      }

      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

export async function startConsumer(): Promise<Consumer> {
  const kafka = new Kafka({
    clientId: `meta-parser-${process.env.HOSTNAME ?? process.pid}`,
    brokers:  config.kafkaBrokers.split(","),
    retry: {
      initialRetryTime: 300,
      retries:          10,
    },
  });

  const consumer = kafka.consumer({
    groupId: config.kafkaGroupId,
    // При rebalance незавершённые сообщения не коммитятся — они будут перечитаны
    sessionTimeout:   30_000,
    heartbeatInterval: 3_000,
  });

  await consumer.connect();
  console.log("[kafka] consumer connected");

  await consumer.subscribe({
    topic:         config.kafkaTopic,
    fromBeginning: false,
  });

  await consumer.run({
    // Параллельная обработка разных партиций внутри одного инстанса.
    // Сообщения одной партиции обрабатываются строго последовательно (порядок по page_id).
    partitionsConsumedConcurrently: config.workerConcurrency,

    eachMessage: async ({ message }: EachMessagePayload) => {
      if (!message.value) return;

      let event: SnapshotUploadedEvent;
      try {
        event = JSON.parse(message.value.toString()) as SnapshotUploadedEvent;
      } catch {
        console.warn("[consumer] invalid JSON in message, skipping");
        return;
      }

      // Retry с экспоненциальным backoff; после исчерпания → DLQ, offset коммитится.
      await processWithRetry(event);
    },
  });

  return consumer;
}
