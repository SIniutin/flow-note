/**
 * Внутренний HTTP-сервер для маршрутизации WebSocket-соединений.
 *
 * Используется api-gateway / балансировщиком для sticky-routing:
 *   GET /page-instance/:pageId  →  { "instance": "collab-service-2:4000" } | { "instance": null }
 *   GET /health                 →  { "status": "ok" }
 *
 * В nginx можно опросить через ngx_http_js_module или через отдельный routing-proxy.
 * Пример:
 *   curl http://collab-service:4001/page-instance/<pageId>
 */

import http from "node:http";
import { getPageInstance } from "./redis/pageRegistry";
import { config } from "./config";

export function startRoutingServer(): void {
  const server = http.createServer(async (req, res) => {
    // ── Health ──────────────────────────────────────────────────────────────
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end('{"status":"ok"}');
      return;
    }

    // ── Page instance lookup ────────────────────────────────────────────────
    const match = req.url?.match(/^\/page-instance\/([^/?]+)/);
    if (!match) {
      res.writeHead(404).end();
      return;
    }

    try {
      const instance = await getPageInstance(decodeURIComponent(match[1]));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ instance }));
    } catch (err) {
      console.error("[routing] getPageInstance error:", err);
      res.writeHead(500).end();
    }
  });

  server.listen(config.routingPort, () => {
    console.log(`[routing] HTTP routing server on :${config.routingPort}`);
  });
}
