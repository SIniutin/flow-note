import { startConsumer }        from "./consumer";
import { disconnectDlqProducer } from "./kafka/dlqProducer";

let consumerRef: Awaited<ReturnType<typeof startConsumer>> | null = null;

async function main(): Promise<void> {
  console.log("[meta-parser] starting…");
  consumerRef = await startConsumer();
  console.log("[meta-parser] ready");
}

async function shutdown(signal: string): Promise<void> {
  console.log(`[meta-parser] ${signal} — disconnecting…`);
  if (consumerRef) {
    await consumerRef.disconnect().catch((err: unknown) =>
      console.error("[meta-parser] consumer disconnect error:", err)
    );
  }
  await disconnectDlqProducer().catch((err: unknown) =>
    console.error("[meta-parser] dlq disconnect error:", err)
  );
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  console.error("[meta-parser] unhandledRejection:", reason);
});

main().catch((err) => {
  console.error("[meta-parser] startup failed:", err);
  process.exit(1);
});
