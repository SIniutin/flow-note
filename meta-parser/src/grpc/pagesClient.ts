import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import path from "node:path";
import { config } from "../config";
import { PageMetadata } from "../parser/ydocParser";

const PROTO_PATH = path.resolve(__dirname, "../../proto/pages.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs:    String,
  enums:    String,
  defaults: true,
  oneofs:   true,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const proto = grpc.loadPackageDefinition(packageDefinition) as any;

const client = new proto.pages.PagesService(
  config.pagesGrpcAddr,
  grpc.credentials.createInsecure()
);

/**
 * Отправляет распарсенные метаданные в pages-service.
 */
export function updatePageMeta(
  pageId:     string,
  s3Key:      string,
  meta:       PageMetadata,
  snapshotTs: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    client.UpdatePageMeta(
      {
        page_id:      pageId,
        s3_key:       s3Key,
        title:        meta.title,
        content_text: meta.contentText,
        word_count:   meta.wordCount,
        mws_table_ids: meta.mwsTableIds,
        snapshot_ts:  snapshotTs,
      },
      (err: grpc.ServiceError | null) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}
