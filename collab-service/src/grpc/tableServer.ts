import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config";
import { loadTable } from "../mws/tableRegistry";
import { getViews, type CellValue, type RecordRow } from "../mws/mwsClient";
import { verifyToken } from "../auth/jwtVerifier";

const PROTO_PATH = path.resolve(__dirname, "../../../api-contracts/proto/collab/v1/collab.proto");
const API_CONTRACTS_ROOT = path.resolve(__dirname, "../../../api-contracts");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
  includeDirs: fs.existsSync(API_CONTRACTS_ROOT) ? [API_CONTRACTS_ROOT] : undefined,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const proto = grpc.loadPackageDefinition(packageDefinition) as any;

function extractBearerToken(metadata: grpc.Metadata): string {
  const value = metadata.get("authorization")[0];
  const raw = typeof value === "string" ? value : "";
  if (!raw) return "";
  const prefix = "bearer ";
  return raw.toLowerCase().startsWith(prefix) ? raw.slice(prefix.length) : raw;
}

function toPlainRecord(row: RecordRow): Record<string, CellValue | null> {
  const out: Record<string, CellValue | null> = {};
  for (const [fieldId, value] of Object.entries(row)) {
    out[fieldId] = value ?? null;
  }
  return out;
}

function verifyBearerToken(metadata: grpc.Metadata): string {
  const token = extractBearerToken(metadata);
  if (!token) {
    throw {
      code: grpc.status.UNAUTHENTICATED,
      message: "missing access token",
    };
  }

  try {
    verifyToken(token);
  } catch (err) {
    throw {
      code: grpc.status.UNAUTHENTICATED,
      message: err instanceof Error ? err.message : "invalid token",
    };
  }

  return token;
}

export async function startTableGrpcServer(): Promise<grpc.Server> {
  const server = new grpc.Server();

  server.addService(proto.collab.v1.CollabTableService.service, {
    GetTable: async (
      call: grpc.ServerUnaryCall<{ dst_id: string }, { dst_id: string; view_id: string; rows: Array<{ record_id: string; cells: Record<string, CellValue | null> }> }>,
      callback: grpc.sendUnaryData<{ dst_id: string; view_id: string; rows: Array<{ record_id: string; cells: Record<string, CellValue | null> }> }>
    ) => {
      const dstId = call.request.dst_id;
      if (!dstId) {
        callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: "dst_id is required",
        });
        return;
      }

      try {
        const token = verifyBearerToken(call.metadata);
        const cells = await loadTable(dstId, token);
        const rows = Array.from(cells.entries()).map(([recordId, fields]) => ({
          record_id: recordId,
          cells: toPlainRecord(fields),
        }));
        callback(null, { dst_id: dstId, view_id: "", rows });
      } catch (err) {
        callback((err as grpc.ServiceError).code ? err as grpc.ServiceError : {
          code: grpc.status.INTERNAL,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },

    ListTableViews: async (
      call: grpc.ServerUnaryCall<{ dst_id: string }, { dst_id: string; views: Array<{ view_id: string; name: string; type: string }> }>,
      callback: grpc.sendUnaryData<{ dst_id: string; views: Array<{ view_id: string; name: string; type: string }> }>
    ) => {
      const dstId = call.request.dst_id;
      if (!dstId) {
        callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: "dst_id is required",
        });
        return;
      }

      try {
        const token = verifyBearerToken(call.metadata);
        const views = await getViews(dstId, token);
        callback(null, {
          dst_id: dstId,
          views: views.map((view) => ({
            view_id: view.id,
            name: view.name,
            type: view.type,
          })),
        });
      } catch (err) {
        callback((err as grpc.ServiceError).code ? err as grpc.ServiceError : {
          code: grpc.status.INTERNAL,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },

    GetTableView: async (
      call: grpc.ServerUnaryCall<{ dst_id: string; view_id: string }, { dst_id: string; view_id: string; rows: Array<{ record_id: string; cells: Record<string, CellValue | null> }> }>,
      callback: grpc.sendUnaryData<{ dst_id: string; view_id: string; rows: Array<{ record_id: string; cells: Record<string, CellValue | null> }> }>
    ) => {
      const dstId = call.request.dst_id;
      const viewId = call.request.view_id;
      if (!dstId || !viewId) {
        callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: "dst_id and view_id are required",
        });
        return;
      }

      try {
        const token = verifyBearerToken(call.metadata);
        const cells = await loadTable(dstId, token, viewId);
        const rows = Array.from(cells.entries()).map(([recordId, fields]) => ({
          record_id: recordId,
          cells: toPlainRecord(fields),
        }));
        callback(null, { dst_id: dstId, view_id: viewId, rows });
      } catch (err) {
        callback((err as grpc.ServiceError).code ? err as grpc.ServiceError : {
          code: grpc.status.INTERNAL,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  });

  await new Promise<void>((resolve, reject) => {
    server.bindAsync(
      `0.0.0.0:${config.grpcPort}`,
      grpc.ServerCredentials.createInsecure(),
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        server.start();
        console.log(`[grpc] collab table service on :${config.grpcPort}`);
        resolve();
      }
    );
  });

  return server;
}
