/**
 * mcpServer.js
 *
 * MCP Server registration for the Freshdesk connector.
 *
 * Every tool call goes through three layers before hitting the Freshdesk API:
 *   1. Zod validation  — reject bad input immediately with a 400-class error
 *   2. Domain dispatch — call the appropriate tool function
 *   3. Error handling  — normalise errors into structured MCP isError responses
 *
 * Tools (11 total):
 *   Tickets  : list, get, search, get_conversations, list_ticket_fields
 *   Contacts : get, list, search
 *   Agents   : list, get, whoami
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import {
  listTickets,
  getTicket,
  searchTickets,
  getTicketConversations,
  listTicketFields,
  STATUS_MAP,
  PRIORITY_MAP,
} from "./tools/tickets.js";
import { getContact, listContacts, searchContacts } from "./tools/contacts.js";
import { getAgent, listAgents, getCurrentAgent } from "./tools/agents.js";
import { logger } from "./utils/logger.js";
import {
  validate,
  ListTicketsSchema,
  GetTicketSchema,
  SearchTicketsSchema,
  GetConversationsSchema,
  GetContactSchema,
  ListContactsSchema,
  SearchContactsSchema,
  GetAgentSchema,
  ListAgentsSchema,
} from "./utils/validate.js";

// ─── Tool definitions (JSON Schema) ──────────────────────────────────────────
// These are what MCP clients use to present tool options and validate args
// before calling. They intentionally mirror the Zod schemas in validate.js.

const TOOLS = [
  // ── Tickets ─────────────────────────────────────────────────────────────────
  {
    name: "freshdesk_list_tickets",
    description:
      "List Freshdesk support tickets. Supports filtering by status, priority, " +
      "requester email, and updated-since date. Returns one page of results.",
    inputSchema: {
      type: "object",
      properties: {
        status:        { type: "string", enum: ["open","pending","resolved","closed"], description: "Filter by ticket status." },
        priority:      { type: "string", enum: ["low","medium","high","urgent"], description: "Filter by ticket priority." },
        email:         { type: "string", description: "Filter by requester email." },
        updated_since: { type: "string", description: "ISO-8601 datetime — tickets updated at or after this time." },
        order_by:      { type: "string", enum: ["created_at","due_by","updated_at","status"], description: "Sort field (default: created_at)." },
        order_type:    { type: "string", enum: ["asc","desc"], description: "Sort direction (default: desc)." },
        page:          { type: "integer", minimum: 1, maximum: 300, description: "Page number (default: 1)." },
        limit:         { type: "integer", minimum: 1, maximum: 100, description: "Results per page (default: 30)." },
      },
    },
  },
  {
    name: "freshdesk_get_ticket",
    description:
      "Fetch a single Freshdesk ticket by its numeric ID. Optionally embed " +
      "conversations, requester details, or SLA stats.",
    inputSchema: {
      type: "object",
      required: ["ticket_id"],
      properties: {
        ticket_id:             { type: "integer", description: "Freshdesk ticket ID." },
        include_conversations: { type: "boolean", description: "Embed the conversation thread." },
        include_requester:     { type: "boolean", description: "Embed requester contact details." },
        include_stats:         { type: "boolean", description: "Embed first-response and resolution SLA stats." },
      },
    },
  },
  {
    name: "freshdesk_search_tickets",
    description:
      "Full-text and structured search across Freshdesk tickets using Freshdesk query syntax. " +
      'Examples: "billing" (free-text), status:2 AND priority:3 (field filters), ' +
      'subject:"payment failed" (phrase). Max 1 000 results (10 pages × 100).',
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", description: "Freshdesk search query string." },
        page:  { type: "integer", minimum: 1, maximum: 10, description: "Page number (default: 1)." },
      },
    },
  },
  {
    name: "freshdesk_get_conversations",
    description:
      "Fetch all replies and notes (public and private) on a Freshdesk ticket. " +
      "Automatically retrieves all pages.",
    inputSchema: {
      type: "object",
      required: ["ticket_id"],
      properties: {
        ticket_id: { type: "integer", description: "Freshdesk ticket ID." },
      },
    },
  },
  {
    name: "freshdesk_list_ticket_fields",
    description:
      "Return metadata for all Freshdesk ticket fields, including custom fields. " +
      "Use this to discover valid filter keys and allowed values.",
    inputSchema: { type: "object", properties: {} },
  },

  // ── Contacts ─────────────────────────────────────────────────────────────────
  {
    name: "freshdesk_get_contact",
    description: "Fetch a single Freshdesk contact (customer / requester) by their numeric ID.",
    inputSchema: {
      type: "object",
      required: ["contact_id"],
      properties: {
        contact_id: { type: "integer", description: "Freshdesk contact ID." },
      },
    },
  },
  {
    name: "freshdesk_list_contacts",
    description:
      "List Freshdesk contacts. Filter by email, mobile, or phone.",
    inputSchema: {
      type: "object",
      properties: {
        email:         { type: "string", description: "Filter by exact email address." },
        mobile:        { type: "string", description: "Filter by mobile number." },
        phone:         { type: "string", description: "Filter by phone number." },
        updated_since: { type: "string", description: "ISO-8601 datetime." },
        page:          { type: "integer", minimum: 1, description: "Page number (default: 1)." },
        limit:         { type: "integer", minimum: 1, maximum: 100, description: "Results per page (default: 30)." },
      },
    },
  },
  {
    name: "freshdesk_search_contacts",
    description: "Autocomplete-search contacts by name, email, phone, or mobile (min 3 chars).",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", minLength: 3, description: "Search term (at least 3 characters)." },
      },
    },
  },

  // ── Agents ───────────────────────────────────────────────────────────────────
  {
    name: "freshdesk_list_agents",
    description: "List all Freshdesk support agents, optionally filtered by email.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Filter by agent email." },
        page:  { type: "integer", minimum: 1, description: "Page number." },
        limit: { type: "integer", minimum: 1, maximum: 100, description: "Results per page." },
      },
    },
  },
  {
    name: "freshdesk_get_agent",
    description: "Fetch a single Freshdesk support agent by their numeric ID.",
    inputSchema: {
      type: "object",
      required: ["agent_id"],
      properties: {
        agent_id: { type: "integer", description: "Freshdesk agent ID." },
      },
    },
  },
  {
    name: "freshdesk_whoami",
    description:
      "Return the agent profile tied to the current API key. " +
      "Use this to verify credentials or discover the authenticated agent's ID.",
    inputSchema: { type: "object", properties: {} },
  },
];

// ─── Tool dispatch ────────────────────────────────────────────────────────────

async function dispatchTool(name, rawArgs) {
  switch (name) {
    // ── Tickets ─────────────────────────────────────────────────────────────
    case "freshdesk_list_tickets": {
      const args = validate(ListTicketsSchema, rawArgs);
      // Convert string labels → Freshdesk numeric codes
      if (args.status)   args.status   = STATUS_MAP[args.status];
      if (args.priority) args.priority = PRIORITY_MAP[args.priority];
      return listTickets(args);
    }

    case "freshdesk_get_ticket": {
      const args = validate(GetTicketSchema, rawArgs);
      return getTicket(args.ticket_id, args);
    }

    case "freshdesk_search_tickets": {
      const args = validate(SearchTicketsSchema, rawArgs);
      return searchTickets(args.query, args.page);
    }

    case "freshdesk_get_conversations": {
      const { ticket_id } = validate(GetConversationsSchema, rawArgs);
      return getTicketConversations(ticket_id);
    }

    case "freshdesk_list_ticket_fields":
      return listTicketFields();

    // ── Contacts ─────────────────────────────────────────────────────────────
    case "freshdesk_get_contact": {
      const { contact_id } = validate(GetContactSchema, rawArgs);
      return getContact(contact_id);
    }

    case "freshdesk_list_contacts": {
      const args = validate(ListContactsSchema, rawArgs);
      return listContacts(args);
    }

    case "freshdesk_search_contacts": {
      const { query } = validate(SearchContactsSchema, rawArgs);
      return searchContacts(query);
    }

    // ── Agents ───────────────────────────────────────────────────────────────
    case "freshdesk_list_agents": {
      const args = validate(ListAgentsSchema, rawArgs);
      return listAgents(args);
    }

    case "freshdesk_get_agent": {
      const { agent_id } = validate(GetAgentSchema, rawArgs);
      return getAgent(agent_id);
    }

    case "freshdesk_whoami":
      return getCurrentAgent();

    default:
      throw { code: 404, message: `Unknown tool: "${name}"` };
  }
}

// ─── Server factory ───────────────────────────────────────────────────────────

export function createMcpServer() {
  const server = new Server(
    { name: "freshdesk-connector", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;

    logger.info("tool call", { tool: name });

    try {
      const result = await dispatchTool(name, rawArgs ?? {});
      logger.info("tool success", { tool: name });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const isStructured = err && typeof err === "object" && "code" in err;
      const message      = isStructured ? err.message : String(err);
      const details      = isStructured && err.details
        ? `\nDetails: ${JSON.stringify(err.details)}`
        : "";

      logger.error("tool error", { tool: name, code: isStructured ? err.code : 0, message });

      return {
        content: [{ type: "text", text: `Error: ${message}${details}` }],
        isError: true,
      };
    }
  });

  return server;
}
