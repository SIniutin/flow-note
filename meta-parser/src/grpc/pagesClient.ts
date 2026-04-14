import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config";
import { PageMetadata } from "../parser/ydocParser";

const SHARED_PROTO_PATH = path.resolve(__dirname, "../../../api-contracts/proto/pages/v1/pages.proto");
const LOCAL_PROTO_PATH = path.resolve(__dirname, "../../proto/pages/v1/pages.proto");
const PROTO_PATH = fs.existsSync(SHARED_PROTO_PATH) ? SHARED_PROTO_PATH : LOCAL_PROTO_PATH;
const INCLUDE_DIRS = fs.existsSync(SHARED_PROTO_PATH)
  ? [path.resolve(__dirname, "../../../api-contracts")]
  : [path.resolve(__dirname, "../../proto")];

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs:    String,
  enums:    String,
  defaults: true,
  oneofs:   true,
  includeDirs: INCLUDE_DIRS,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const proto = grpc.loadPackageDefinition(packageDefinition) as any;

const client = new proto.pages.v1.PagesService(
  config.pagesGrpcAddr,
  grpc.credentials.createInsecure()
);

function buildMetadata(): grpc.Metadata | undefined {
  if (!config.pagesAuthToken) return undefined;

  const md = new grpc.Metadata();
  md.set("authorization", `Bearer ${config.pagesAuthToken}`);
  return md;
}

function unaryCall(method: string, payload: object): Promise<void> {
  return new Promise((resolve, reject) => {
    const metadata = buildMetadata();
    const cb = (err: grpc.ServiceError | null) => {
      if (err) reject(err);
      else resolve();
    };

    if (metadata) {
      client[method](payload, metadata, cb);
      return;
    }

    client[method](
      payload,
      (err: grpc.ServiceError | null) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

/**
 * Синхронизирует извлечённые из snapshot связи страницы с pages-service.
 * Пока отправляем только таблицы; links/mentions/media идут пустыми replace-запросами.
 */
export async function replacePageRelations(pageId: string, meta: PageMetadata): Promise<void> {
  await Promise.all([
    unaryCall("ReplacePageLinks", {
      page_id: pageId,
      links: [],
    }),
    unaryCall("ReplacePageMentions", {
      page_id: pageId,
      mentions: [],
    }),
    unaryCall("ReplacePageTables", {
      page_id: pageId,
      tables: meta.tables.map((table) => ({
        dst_id: table.dstId,
        block_id: table.blockId,
      })),
    }),
    unaryCall("ReplacePageMedia", {
      page_id: pageId,
      media: [],
    }),
  ]);
}
