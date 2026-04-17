/**
 * Kafka producer для Dead Letter Queue.
 * Сообщения, которые не удалось обработать после MAX_PROCESS_ATTEMPTS,
 * отправляются в топик page.snapshot.dlq для ручного разбора.
 */

import { Kafka, Producer } from "kafkajs";
import { config }          from "../config";

export const DLQ_TOPIC = `${config.kafkaTopic}.dlq`;

const kafka = new Kafka({
  clientId: `${config.kafkaGroupId}-dlq`,
  brokers:  config.kafkaBrokers.split(","),
  retry: { retries: 3 },
});

let producer: Producer | null = null;

async function getProducer(): Promise<Producer> {
  if (producer) return producer;
  const p = kafka.producer();
  await p.connect();
  producer = p;
  console.log("[dlq] producer connected");
  return p;
}

export interface DlqRecord {
  original_event: unknown;
  error:          string;
  failed_at:      number;
}

export async function sendToDlq(original: unknown, err: Error): Promise<void> {
  const record: DlqRecord = {
    original_event: original,
    error:          err.message,
    failed_at:      Date.now(),
  };

  const p = await getProducer();
  await p.send({
    topic:    DLQ_TOPIC,
    messages: [{ value: JSON.stringify(record) }],
  });

  console.warn(`[dlq] sent  topic=${DLQ_TOPIC}  error="${err.message}"`);
}

export async function disconnectDlqProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
    console.log("[dlq] producer disconnected");
  }
}
