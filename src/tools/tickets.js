/**
 * tools/tickets.js
 *
 * Freshdesk Tickets API — list, get, search, conversations, fields.
 *
 * Freshdesk status codes:  2=Open  3=Pending  4=Resolved  5=Closed
 * Freshdesk priority codes: 1=Low  2=Medium  3=High  4=Urgent
 */

import { getHttpClient, normaliseError } from "../utils/httpClient.js";
import { buildPageParams, fetchAllPages } from "../utils/pagination.js";

// ─── Status / priority helpers ────────────────────────────────────────────────

export const STATUS_MAP   = { open: 2, pending: 3, resolved: 4, closed: 5 };
export const PRIORITY_MAP = { low: 1, medium: 2, high: 3, urgent: 4 };

const STATUS_LABEL   = Object.fromEntries(Object.entries(STATUS_MAP).map(([k, v]) => [v, k]));
const PRIORITY_LABEL = Object.fromEntries(Object.entries(PRIORITY_MAP).map(([k, v]) => [v, k]));

/** Add human-readable label fields alongside the numeric codes. */
function decorateTicket(t) {
  return {
    ...t,
    status_label:   STATUS_LABEL[t.status]     ?? String(t.status),
    priority_label: PRIORITY_LABEL[t.priority] ?? String(t.priority),
  };
}

// ─── List tickets ─────────────────────────────────────────────────────────────

/**
 * @param {object} params - already validated by ListTicketsSchema
 */
export async function listTickets(params = {}) {
  const client = getHttpClient();
  const { page, per_page } = buildPageParams({ limit: params.limit, page: params.page });

  const query = { page, per_page };
  if (params.status        != null) query.status        = params.status;
  if (params.priority      != null) query.priority      = params.priority;
  if (params.requester_id  != null) query.requester_id  = params.requester_id;
  if (params.email)                  query.email         = params.email;
  if (params.updated_since)          query.updated_since = params.updated_since;
  if (params.order_by)               query.order_by      = params.order_by;
  if (params.order_type)             query.order_type    = params.order_type;
  if (params.filter)                 query.filter        = params.filter;

  try {
    const { data } = await client.get("/tickets", { params: query });
    const tickets = (Array.isArray(data) ? data : []).map(decorateTicket);
    return { tickets, total_on_page: tickets.length };
  } catch (err) {
    throw normaliseError(err);
  }
}

// ─── Get single ticket ────────────────────────────────────────────────────────

/**
 * @param {number|string} ticketId
 * @param {object} opts - already validated by GetTicketSchema
 */
export async function getTicket(ticketId, opts = {}) {
  const client = getHttpClient();
  const includes = [];
  if (opts.include_conversations) includes.push("conversations");
  if (opts.include_requester)     includes.push("requester");
  if (opts.include_stats)         includes.push("stats");

  const params = includes.length ? { include: includes.join(",") } : {};

  try {
    const { data } = await client.get(`/tickets/${ticketId}`, { params });
    return decorateTicket(data);
  } catch (err) {
    throw normaliseError(err);
  }
}

// ─── Search tickets ───────────────────────────────────────────────────────────

/**
 * Full-text + structured search using Freshdesk's Search API.
 *
 * IMPORTANT: Freshdesk's search endpoint expects the query string passed
 * verbatim as the `query` parameter — do NOT wrap it in extra quotes, as that
 * breaks field-filter syntax like `status:2 AND priority:3`.
 *
 * The caller (validated by SearchTicketsSchema) is responsible for quoting
 * individual phrases when needed, e.g.: subject:"payment failed"
 *
 * Max results: 1 000 (10 pages × 100).
 *
 * @param {string} query
 * @param {number} [page=1]
 */
export async function searchTickets(query, page = 1) {
  const client = getHttpClient();
  const safePage = Math.min(Math.max(1, page), 10);

  try {
    const { data } = await client.get("/search/tickets", {
      params: { query, page: safePage },
    });
    const tickets = (data.results ?? []).map(decorateTicket);
    return { tickets, total: data.total ?? tickets.length, page: safePage };
  } catch (err) {
    throw normaliseError(err);
  }
}

// ─── Get ticket conversations ─────────────────────────────────────────────────

/**
 * Fetch all replies and notes for a ticket, auto-paginating.
 *
 * @param {number|string} ticketId
 */
export async function getTicketConversations(ticketId) {
  const client = getHttpClient();
  try {
    const records = await fetchAllPages(async (page) => {
      const { data } = await client.get(`/tickets/${ticketId}/conversations`, {
        params: { page, per_page: 100 },
      });
      return Array.isArray(data) ? data : [];
    });
    return records;
  } catch (err) {
    throw normaliseError(err);
  }
}

// ─── List ticket fields ───────────────────────────────────────────────────────

/**
 * Return metadata about all ticket fields, including custom fields.
 */
export async function listTicketFields() {
  const client = getHttpClient();
  try {
    const { data } = await client.get("/ticket_fields");
    return Array.isArray(data) ? data : [];
  } catch (err) {
    throw normaliseError(err);
  }
}
