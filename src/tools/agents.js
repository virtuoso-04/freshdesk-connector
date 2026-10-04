/**
 * tools/agents.js
 *
 * Freshdesk Agents API primitives.
 * Agents are the support staff members who handle tickets.
 */

import { getHttpClient, normaliseError } from "../utils/httpClient.js";

// ─── Get agent ────────────────────────────────────────────────────────────────

/**
 * Fetch a single agent by ID.
 *
 * @param {number|string} agentId
 * @returns {Promise<object>}
 */
export async function getAgent(agentId) {
  const client = getHttpClient();
  try {
    const { data } = await client.get(`/agents/${agentId}`);
    return data;
  } catch (err) {
    throw normaliseError(err);
  }
}

// ─── List agents ──────────────────────────────────────────────────────────────

/**
 * List all agents, optionally filtered.
 *
 * @param {object} [params]
 * @param {string}  [params.email]       Filter by agent email
 * @param {string}  [params.mobile]      Filter by mobile number
 * @param {string}  [params.phone]       Filter by phone number
 * @param {number}  [params.page]        1-based page number
 * @param {number}  [params.limit]       Records per page (1–100)
 * @returns {Promise<object[]>}
 */
export async function listAgents(params = {}) {
  const client = getHttpClient();
  const query = {};
  if (params.email) query.email = params.email;
  if (params.mobile) query.mobile = params.mobile;
  if (params.phone) query.phone = params.phone;
  if (params.page) query.page = params.page;
  if (params.limit) query.per_page = Math.min(params.limit, 100);

  try {
    const { data } = await client.get("/agents", { params: query });
    return Array.isArray(data) ? data : [];
  } catch (err) {
    throw normaliseError(err);
  }
}

// ─── Get current agent (me) ───────────────────────────────────────────────────

/**
 * Return the agent associated with the currently authenticated API key.
 *
 * @returns {Promise<object>}
 */
export async function getCurrentAgent() {
  const client = getHttpClient();
  try {
    const { data } = await client.get("/agents/me");
    return data;
  } catch (err) {
    throw normaliseError(err);
  }
}
