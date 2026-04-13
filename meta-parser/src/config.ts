function int(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function str(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  // ── Kafka ─────────────────────────────────────────────────────────────────
  kafkaBrokers:       str("KAFKA_BROKERS",    "kafka:9092"),
  kafkaGroupId:       str("KAFKA_GROUP_ID",   "meta-parser"),
  kafkaTopic:         str("KAFKA_TOPIC",      "page.snapshot.uploaded"),
  workerConcurrency:  int("WORKER_CONCURRENCY", 4),

  // ── Object Storage ────────────────────────────────────────────────────────
  s3Endpoint:  str("S3_ENDPOINT",   "http://minio:9000"),
  s3Bucket:    str("S3_BUCKET",     "snapshots"),
  s3AccessKey: str("S3_ACCESS_KEY", "minioadmin"),
  s3SecretKey: str("S3_SECRET_KEY", "minioadmin"),
  s3Region:    str("S3_REGION",     "us-east-1"),

  // ── pages-service gRPC ────────────────────────────────────────────────────
  pagesGrpcAddr: str("PAGES_GRPC_ADDR", "localhost:50051"),
} as const;
