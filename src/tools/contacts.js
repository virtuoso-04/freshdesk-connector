/**
 * tools/contacts.js
 *
 * Freshdesk Contacts (requesters) API primitives.
 * Contacts represent the customers / end-users who submit tickets.
 */

import { getHttpClient, normaliseError } from "../utils/httpClient.js";
import { buildPageParams } from "../utils/pagination.js";

// ─── Get contact ──────────────────────────────────────────────────────────────

/**
 * Fetch a single contact by ID.
 *
 * @param {number|string} contactId
 * @returns {Promise<object>}
 */
export async function getContact(contactId) {
  const client = getHttpClient();
  try {
    const { data } = await client.get(`/contacts/${contactId}`);
    return data;
  } catch (err) {
    throw normaliseError(err);
  }
}

// ─── List / filter contacts ───────────────────────────────────────────────────

/**
 * List contacts with optional filters.
 *
 * @param {object} params
 * @param {string}  [params.email]         Filter by exact email address
 * @param {string}  [params.mobile]        Filter by mobile number
 * @param {string}  [params.phone]         Filter by phone number
 * @param {string}  [params.updated_since] ISO-8601 — contacts updated after this time
 * @param {number}  [params.page]          1-based page number
 * @param {number}  [params.limit]         Records per page (1–100)
 * @returns {Promise<{ contacts: object[], total_on_page: number }>}
 */
export async function listContacts(params = {}) {
  const client = getHttpClient();
  const { page, per_page } = buildPageParams({ limit: params.limit, page: params.page });

  const query = { page, per_page };
  if (params.email) query.email = params.email;
  if (params.mobile) query.mobile = params.mobile;
  if (params.phone) query.phone = params.phone;
  if (params.updated_since) query.updated_since = params.updated_since;

  try {
    const { data } = await client.get("/contacts", { params: query });
    const contacts = Array.isArray(data) ? data : [];
    return { contacts, total_on_page: contacts.length };
  } catch (err) {
    throw normaliseError(err);
  }
}

// ─── Search contacts ──────────────────────────────────────────────────────────

/**
 * Search contacts by name, email, phone, or mobile.
 *
 * Freshdesk provides a dedicated search endpoint for contacts.
 *
 * @param {string} query  Search term (min 3 characters)
 * @returns {Promise<object[]>}
 */
export async function searchContacts(query) {
  if (!query || query.trim().length < 3) {
    throw { code: 400, message: "query must be at least 3 characters." };
  }
  const client = getHttpClient();
  try {
    const { data } = await client.get("/contacts/autocomplete", {
      params: { term: query.trim() },
    });
    return Array.isArray(data) ? data : [];
  } catch (err) {
    throw normaliseError(err);
  }
}
