#!/usr/bin/env node
/**
 * index.js — Freshdesk Connector entry-point
 *
 * Transports:
 *   stdio (default) — MCP JSON-RPC over stdin/stdout.
 *                     Used by Agent Studio, Claude Desktop, etc.
 *   http            — HTTP + Server-Sent Events.
 *                     Useful for remote or multi-client deployments.
 *
 * Usage:
 *   node src/index.js
 *   MCP_TRANSPORT=http MCP_HTTP_PORT=3000 node src/index.js
 */

import { config as loadDotenv } from "dotenv";
loadDotenv(); // no-op if .env doesn't exist

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./mcpServer.js";
import { buildAuthConfig, redactApiKey } from "./auth/apiKey.js";
import { logger } from "./utils/logger.js";

// ─── Validate credentials before doing anything else ─────────────────────────
let authConfig;
try {
  authConfig = buildAuthConfig();
} catch (err) {
  // Use plain stderr so this is visible even before the logger is relied upon
  process.stderr.write(
    `\n[freshdesk-connector] Configuration error:\n  ${err.message}\n\n`
  );
  process.exit(1);
}

logger.info("freshdesk-connector starting", {
  baseURL:   authConfig.baseURL,
  apiKey:    redactApiKey(process.env.FRESHDESK_API_KEY),
  transport: process.env.MCP_TRANSPORT ?? "stdio",
});

// ─── Launch ───────────────────────────────────────────────────────────────────

const transport = process.env.MCP_TRANSPORT ?? "stdio";

if (transport === "stdio") {
  await runStdio();
} else if (transport === "http") {
  await runHttp();
} else {
  process.stderr.write(
    `[freshdesk-connector] Unknown transport "${transport}". Use "stdio" or "http".\n`
  );
  process.exit(1);
}

// ─── Stdio transport ──────────────────────────────────────────────────────────

async function runStdio() {
  const server    = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MCP server ready", { transport: "stdio" });
}

// ─── HTTP / SSE transport ─────────────────────────────────────────────────────
//
// The MCP SSE transport works like this:
//   GET  /sse      — client opens an SSE stream; server sends a sessionId
//   POST /message  — client posts JSON-RPC messages with ?sessionId=<id>
//
// We maintain a Map of sessionId → SSEServerTransport so that concurrent
// clients each get their own isolated MCP server instance.

async function runHttp() {
  const { SSEServerTransport } = await import("@modelcontextprotocol/sdk/server/sse.js");
  const { default: http }      = await import("http");

  const port = parseInt(process.env.MCP_HTTP_PORT ?? "3000", 10);

  /** @type {Map<string, import('@modelcontextprotocol/sdk/server/sse.js').SSEServerTransport>} */
  const sessions = new Map();

  const httpServer = http.createServer(async (req, res) => {
    // ── GET /sse — open a new SSE session ─────────────────────────────────────
    if (req.method === "GET" && req.url === "/sse") {
      const sseTransport = new SSEServerTransport("/message", res);

      // Each SSE client gets its own MCP server instance
      const server = createMcpServer();
      await server.connect(sseTransport);

      const sessionId = sseTransport.sessionId;
      sessions.set(sessionId, sseTransport);
      logger.info("SSE session opened", { sessionId });

      res.on("close", () => {
        sessions.delete(sessionId);
        logger.info("SSE session closed", { sessionId });
      });
      return;
    }

    // ── POST /message — deliver a JSON-RPC message to an existing session ─────
    if (req.method === "POST" && req.url?.startsWith("/message")) {
      const url       = new URL(req.url, `http://localhost:${port}`);
      const sessionId = url.searchParams.get("sessionId");
      const sseT      = sessions.get(sessionId);

      if (!sseT) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `Session ${sessionId} not found.` }));
        return;
      }

      await sseT.handlePostMessage(req, res);
      return;
    }

    // ── Health-check ──────────────────────────────────────────────────────────
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", sessions: sessions.size }));
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  httpServer.listen(port, () => {
    logger.info("MCP server ready", {
      transport:    "http/sse",
      port,
      sse_endpoint: `http://localhost:${port}/sse`,
      msg_endpoint: `http://localhost:${port}/message`,
      health:       `http://localhost:${port}/health`,
    });
  });
}
