/**
 * Tests for utils/validate.js
 */

import { describe, it, expect } from "@jest/globals";
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
} from "../utils/validate.js";

// ─── validate() helper ────────────────────────────────────────────────────────

describe("validate()", () => {
  it("returns parsed data for valid input", () => {
    const result = validate(GetTicketSchema, { ticket_id: 42 });
    expect(result.ticket_id).toBe(42);
    // Default values should be applied
    expect(result.include_conversations).toBe(false);
    expect(result.include_requester).toBe(false);
    expect(result.include_stats).toBe(false);
  });

  it("throws { code: 400 } for invalid input", () => {
    expect(() => validate(GetTicketSchema, { ticket_id: -1 })).toThrow();
    try {
      validate(GetTicketSchema, { ticket_id: -1 });
    } catch (err) {
      expect(err.code).toBe(400);
      expect(err.message).toMatch(/Validation error/);
    }
  });

  it("throws for missing required fields", () => {
    expect(() => validate(GetTicketSchema, {})).toThrow();
  });
});

// ─── ListTicketsSchema ────────────────────────────────────────────────────────

describe("ListTicketsSchema", () => {
  it("accepts valid status and priority enums", () => {
    const r = validate(ListTicketsSchema, { status: "open", priority: "high" });
    expect(r.status).toBe("open");
    expect(r.priority).toBe("high");
  });

  it("rejects unknown status", () => {
    expect(() => validate(ListTicketsSchema, { status: "broken" })).toThrow();
  });

  it("applies default page=1 and limit=30", () => {
    const r = validate(ListTicketsSchema, {});
    expect(r.page).toBe(1);
    expect(r.limit).toBe(30);
  });

  it("rejects limit > 100", () => {
    expect(() => validate(ListTicketsSchema, { limit: 200 })).toThrow();
  });

  it("rejects invalid email", () => {
    expect(() => validate(ListTicketsSchema, { email: "not-an-email" })).toThrow();
  });
});

// ─── SearchTicketsSchema ──────────────────────────────────────────────────────

describe("SearchTicketsSchema", () => {
  it("accepts a valid query string", () => {
    const r = validate(SearchTicketsSchema, { query: "billing" });
    expect(r.query).toBe("billing");
    expect(r.page).toBe(1);
  });

  it("rejects empty query", () => {
    expect(() => validate(SearchTicketsSchema, { query: "" })).toThrow();
    expect(() => validate(SearchTicketsSchema, { query: "   " })).toThrow();
  });

  it("rejects page > 10", () => {
    expect(() => validate(SearchTicketsSchema, { query: "test", page: 11 })).toThrow();
  });

  it("trims whitespace from query", () => {
    const r = validate(SearchTicketsSchema, { query: "  test  " });
    expect(r.query).toBe("test");
  });
});

// ─── Contact schemas ──────────────────────────────────────────────────────────

describe("GetContactSchema", () => {
  it("accepts positive integer", () => {
    expect(validate(GetContactSchema, { contact_id: 1 }).contact_id).toBe(1);
  });
  it("rejects non-integer", () => {
    expect(() => validate(GetContactSchema, { contact_id: 1.5 })).toThrow();
  });
});

describe("SearchContactsSchema", () => {
  it("rejects query shorter than 3 chars", () => {
    expect(() => validate(SearchContactsSchema, { query: "ab" })).toThrow();
  });
  it("accepts 3-char query", () => {
    expect(validate(SearchContactsSchema, { query: "abc" }).query).toBe("abc");
  });
});

describe("ListContactsSchema", () => {
  it("accepts valid email", () => {
    const r = validate(ListContactsSchema, { email: "user@example.com" });
    expect(r.email).toBe("user@example.com");
  });
  it("rejects invalid email", () => {
    expect(() => validate(ListContactsSchema, { email: "invalid" })).toThrow();
  });
});

// ─── Agent schemas ────────────────────────────────────────────────────────────

describe("GetAgentSchema", () => {
  it("requires agent_id", () => {
    expect(() => validate(GetAgentSchema, {})).toThrow();
  });
  it("accepts valid agent_id", () => {
    expect(validate(GetAgentSchema, { agent_id: 99 }).agent_id).toBe(99);
  });
});

describe("ListAgentsSchema", () => {
  it("applies defaults", () => {
    const r = validate(ListAgentsSchema, {});
    expect(r.page).toBe(1);
    expect(r.limit).toBe(30);
  });
});
