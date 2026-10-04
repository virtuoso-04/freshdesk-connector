/**
 * utils/logger.js
 *
 * Structured JSON logger that writes to stderr only — stdout is reserved for
 * the MCP JSON-RPC stream and must stay clean.
 *
 * Every log line is a single JSON object:
 *   { ts, level, msg, ...context }
 *
 * LOG_LEVEL env var controls verbosity: debug | info | warn | error (default: info)
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

const configuredLevel = LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LEVELS.info;

function write(level, msg, ctx = {}) {
  if (LEVELS[level] < configuredLevel) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...ctx,
  });
  process.stderr.write(line + "\n");
}

export const logger = {
  debug: (msg, ctx) => write("debug", msg, ctx),
  info:  (msg, ctx) => write("info",  msg, ctx),
  warn:  (msg, ctx) => write("warn",  msg, ctx),
  error: (msg, ctx) => write("error", msg, ctx),
};
