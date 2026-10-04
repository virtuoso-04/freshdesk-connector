/**
 * utils/validate.js
 *
 * Zod schemas for every MCP tool's input arguments.
 * Validated in mcpServer.js before any API call is made — bad input is
 * rejected with a 400-style error immediately, never forwarded upstream.
 *
 * Keeping schemas here (not inline in mcpServer) makes them independently
 * testable and reusable across transports.
 */

import { z } from "zod";

// ─── Shared primitives ────────────────────────────────────────────────────────

const positiveInt = z.number().int().positive();
const pageSchema  = z.number().int().min(1).max(300).default(1);
const limitSchema = z.number().int().min(1).max(100).default(30);
const iso8601     = z.string().datetime({ offset: true }).optional();

// ─── Ticket schemas ───────────────────────────────────────────────────────────

export const ListTicketsSchema = z.object({
  status:        z.enum(["open", "pending", "resolved", "closed"]).optional(),
  priority:      z.enum(["low", "medium", "high", "urgent"]).optional(),
  email:         z.string().email().optional(),
  updated_since: iso8601,
  order_by:      z.enum(["created_at", "due_by", "updated_at", "status"]).optional(),
  order_type:    z.enum(["asc", "desc"]).optional(),
  page:          pageSchema,
  limit:         limitSchema,
});

export const GetTicketSchema = z.object({
  ticket_id:             positiveInt,
  include_conversations: z.boolean().default(false),
  include_requester:     z.boolean().default(false),
  include_stats:         z.boolean().default(false),
});

export const SearchTicketsSchema = z.object({
  query: z.string().trim().min(1, "query must not be empty"),
  page:  z.number().int().min(1).max(10).default(1),
});

export const GetConversationsSchema = z.object({
  ticket_id: positiveInt,
});

// ─── Contact schemas ──────────────────────────────────────────────────────────

export const GetContactSchema = z.object({
  contact_id: positiveInt,
});

export const ListContactsSchema = z.object({
  email:         z.string().email().optional(),
  mobile:        z.string().optional(),
  phone:         z.string().optional(),
  updated_since: iso8601,
  page:          pageSchema,
  limit:         limitSchema,
});

export const SearchContactsSchema = z.object({
  query: z.string().trim().min(3, "query must be at least 3 characters"),
});

// ─── Agent schemas ────────────────────────────────────────────────────────────

export const GetAgentSchema = z.object({
  agent_id: positiveInt,
});

export const ListAgentsSchema = z.object({
  email: z.string().email().optional(),
  page:  pageSchema,
  limit: limitSchema,
});

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Parse `raw` with `schema`.  Returns the parsed (coerced) value on success.
 * Throws a structured { code: 400, message } on validation failure so the
 * MCP dispatcher can return it as an isError response.
 *
 * @template T
 * @param {z.ZodType<T>} schema
 * @param {unknown} raw
 * @returns {T}
 */
export function validate(schema, raw) {
  const result = schema.safeParse(raw ?? {});
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".") || "input"}: ${i.message}`)
      .join("; ");
    throw { code: 400, message: `Validation error — ${issues}` };
  }
  return result.data;
}
