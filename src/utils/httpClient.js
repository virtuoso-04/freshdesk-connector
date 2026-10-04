/**
 * utils/httpClient.js
 *
 * Pre-configured Axios instance with:
 *   - Freshdesk base URL + API-key Basic Auth
 *   - Bottleneck rate-limiter (queues calls to stay within Freshdesk quotas)
 *   - axios-retry with exponential back-off + Retry-After header support
 *   - Structured request/response logging (debug level)
 *   - Normalised error objects
 *
 * Freshdesk rate limits (per-minute, as documented):
 *   Free / Growth  : 100 req/min
 *   Pro            : 200 req/min
 *   Enterprise     : 400 req/min
 *
 * Defaults (200 ms min-delay × 5 concurrent ≈ 25 req/s  well under any plan).
 * Tune via FRESHDESK_MAX_CONCURRENT and FRESHDESK_MIN_DELAY_MS env vars.
 */

import axios from "axios";
import axiosRetry from "axios-retry";
import Bottleneck from "bottleneck";
import { buildAuthConfig } from "../auth/apiKey.js";
import { logger } from "./logger.js";

// ─── Rate limiter ─────────────────────────────────────────────────────────────

const MAX_CONCURRENT = parseInt(process.env.FRESHDESK_MAX_CONCURRENT ?? "5",  10);
const MIN_DELAY_MS   = parseInt(process.env.FRESHDESK_MIN_DELAY_MS   ?? "200", 10);

const limiter = new Bottleneck({ maxConcurrent: MAX_CONCURRENT, minTime: MIN_DELAY_MS });

// ─── Singleton ────────────────────────────────────────────────────────────────

let _client = null;

/** Reset the singleton — used in tests so each test suite gets a fresh client. */
export function _resetClientForTests() {
  _client = null;
}

/**
 * Return the singleton Axios instance.
 * Must be called after environment variables are loaded.
 *
 * @returns {import('axios').AxiosInstance}
 */
export function getHttpClient() {
  if (_client) return _client;

  const { baseURL, auth } = buildAuthConfig();

  _client = axios.create({
    baseURL,
    auth,
    timeout: 30_000,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
  });

  // ─── Request interceptor — log outbound calls ──────────────────────────────
  _client.interceptors.request.use((config) => {
    const reqId = Math.random().toString(36).slice(2, 9);
    config._reqId = reqId;
    config._startMs = Date.now();
    logger.debug("freshdesk request", {
      reqId,
      method: config.method?.toUpperCase(),
      url: config.url,
      params: config.params,
    });
    return config;
  });

  // ─── Response interceptor — log latency ───────────────────────────────────
  _client.interceptors.response.use(
    (response) => {
      const elapsed = Date.now() - (response.config._startMs ?? 0);
      logger.debug("freshdesk response", {
        reqId: response.config._reqId,
        status: response.status,
        elapsed_ms: elapsed,
      });
      return response;
    },
    (error) => {
      const elapsed = Date.now() - (error.config?._startMs ?? 0);
      logger.warn("freshdesk error response", {
        reqId: error.config?._reqId,
        status: error.response?.status,
        elapsed_ms: elapsed,
        message: error.message,
      });
      return Promise.reject(error);
    }
  );

  // ─── Retry logic ───────────────────────────────────────────────────────────
  axiosRetry(_client, {
    retries: 3,
    retryDelay: (retryCount, error) => {
      const retryAfter = error?.response?.headers?.["retry-after"];
      if (retryAfter) {
        const seconds = parseInt(retryAfter, 10);
        if (!isNaN(seconds)) {
          logger.warn("rate limited — honouring Retry-After", { wait_ms: seconds * 1000 });
          return seconds * 1000;
        }
      }
      const delay = axiosRetry.exponentialDelay(retryCount);
      logger.warn("retrying request", { retryCount, delay_ms: delay });
      return delay;
    },
    retryCondition: (error) =>
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      error?.response?.status === 429 ||
      (error?.response?.status >= 500 && error?.response?.status < 600),
  });

  // ─── Rate-limit scheduling ─────────────────────────────────────────────────
  // Wrap .request() so every outbound call passes through Bottleneck.
  // Axios internally routes .get/.post/etc. through .request(), so this
  // one intercept covers the entire client.
  const originalRequest = _client.request.bind(_client);
  _client.request = (config) => limiter.schedule(() => originalRequest(config));

  return _client;
}

// ─── Error normalisation ──────────────────────────────────────────────────────

/**
 * Convert an Axios error (or any thrown value) into a plain, serialisable
 * object suitable for returning to the MCP caller.
 *
 * @param {unknown} error
 * @returns {{ code: number, message: string, details?: unknown }}
 */
export function normaliseError(error) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 0;
    const data   = error.response?.data ?? {};

    // Freshdesk error shape: { message, errors: [...] } or { description }
    const msg =
      data.message ??
      data.description ??
      HTTP_STATUS_MESSAGES[status] ??
      error.message;

    return {
      code: status,
      message: msg,
      ...(data.errors ? { details: data.errors } : {}),
    };
  }

  if (error instanceof Error) return { code: 0, message: error.message };
  return { code: 0, message: String(error) };
}

const HTTP_STATUS_MESSAGES = {
  400: "Bad Request – check your parameters.",
  401: "Unauthorised – verify FRESHDESK_API_KEY.",
  403: "Forbidden – your API key lacks permission for this resource.",
  404: "Not Found.",
  409: "Conflict – the resource already exists.",
  429: "Too Many Requests – rate limit exceeded.",
  500: "Freshdesk Internal Server Error.",
  503: "Freshdesk Service Unavailable.",
};
