/**
 * Tests for tools/tickets.js
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

const mockGet = jest.fn();
jest.unstable_mockModule("../utils/httpClient.js", () => ({
  getHttpClient: () => ({ get: mockGet }),
  normaliseError: (err) => err,
}));

const { listTickets, getTicket, searchTickets, getTicketConversations, STATUS_MAP, PRIORITY_MAP } =
  await import("../tools/tickets.js");

// ─── listTickets ──────────────────────────────────────────────────────────────

describe("listTickets", () => {
  beforeEach(() => mockGet.mockReset());

  it("calls /tickets with page and per_page defaults", async () => {
    mockGet.mockResolvedValue({ data: [] });
    const result = await listTickets();
    expect(mockGet).toHaveBeenCalledWith("/tickets", {
      params: expect.objectContaining({ page: 1, per_page: 30 }),
    });
    expect(result.tickets).toEqual([]);
    expect(result.total_on_page).toBe(0);
  });

  it("passes numeric status filter", async () => {
    mockGet.mockResolvedValue({ data: [] });
    await listTickets({ status: 2 });
    const [, opts] = mockGet.mock.calls[0];
    expect(opts.params.status).toBe(2);
  });

  it("decorates tickets with status_label and priority_label", async () => {
    mockGet.mockResolvedValue({ data: [{ id: 42, status: 4, priority: 3 }] });
    const { tickets } = await listTickets();
    expect(tickets[0].status_label).toBe("resolved");
    expect(tickets[0].priority_label).toBe("high");
  });

  it("handles non-array response gracefully", async () => {
    mockGet.mockResolvedValue({ data: null });
    const { tickets } = await listTickets();
    expect(tickets).toEqual([]);
  });

  it("passes email filter", async () => {
    mockGet.mockResolvedValue({ data: [] });
    await listTickets({ email: "user@test.com" });
    const [, opts] = mockGet.mock.calls[0];
    expect(opts.params.email).toBe("user@test.com");
  });
});

// ─── getTicket ────────────────────────────────────────────────────────────────

describe("getTicket", () => {
  beforeEach(() => mockGet.mockReset());

  it("fetches /tickets/:id with no extras by default", async () => {
    mockGet.mockResolvedValue({ data: { id: 5, status: 2, priority: 2 } });
    await getTicket(5);
    expect(mockGet).toHaveBeenCalledWith("/tickets/5", { params: {} });
  });

  it("builds include param when flags are set", async () => {
    mockGet.mockResolvedValue({ data: { id: 5, status: 3, priority: 1 } });
    await getTicket(5, { include_conversations: true, include_requester: true, include_stats: true });
    const [, opts] = mockGet.mock.calls[0];
    expect(opts.params.include).toContain("conversations");
    expect(opts.params.include).toContain("requester");
    expect(opts.params.include).toContain("stats");
  });

  it("omits include param when all flags are false", async () => {
    mockGet.mockResolvedValue({ data: { id: 1, status: 2, priority: 1 } });
    await getTicket(1, { include_conversations: false });
    const [, opts] = mockGet.mock.calls[0];
    expect(opts.params.include).toBeUndefined();
  });
});

// ─── searchTickets ────────────────────────────────────────────────────────────

describe("searchTickets", () => {
  beforeEach(() => mockGet.mockReset());

  it("passes query verbatim — no extra quotes wrapping", async () => {
    mockGet.mockResolvedValue({ data: { results: [], total: 0 } });
    await searchTickets("status:2 AND priority:3");
    const [, opts] = mockGet.mock.calls[0];
    // Must NOT be wrapped in extra quotes — that would break field syntax
    expect(opts.params.query).toBe("status:2 AND priority:3");
  });

  it("passes free-text queries unchanged", async () => {
    mockGet.mockResolvedValue({ data: { results: [], total: 0 } });
    await searchTickets("billing");
    const [, opts] = mockGet.mock.calls[0];
    expect(opts.params.query).toBe("billing");
  });

  it("caps search page at 10", async () => {
    mockGet.mockResolvedValue({ data: { results: [], total: 0 } });
    await searchTickets("test", 99);
    const [, opts] = mockGet.mock.calls[0];
    expect(opts.params.page).toBe(10);
  });

  it("decorates results with labels", async () => {
    mockGet.mockResolvedValue({
      data: { results: [{ id: 1, status: 2, priority: 4 }], total: 1 },
    });
    const { tickets } = await searchTickets("test");
    expect(tickets[0].status_label).toBe("open");
    expect(tickets[0].priority_label).toBe("urgent");
  });

  it("falls back to results length when total is missing", async () => {
    mockGet.mockResolvedValue({ data: { results: [{ id: 1, status: 2, priority: 1 }] } });
    const { total } = await searchTickets("test");
    expect(total).toBe(1);
  });
});

// ─── getTicketConversations ───────────────────────────────────────────────────

describe("getTicketConversations", () => {
  beforeEach(() => mockGet.mockReset());

  it("fetches /tickets/:id/conversations and returns all records", async () => {
    // Single page of 2 records
    mockGet.mockResolvedValue({ data: [{ id: 10 }, { id: 11 }] });
    const result = await getTicketConversations(42);
    expect(mockGet).toHaveBeenCalledWith("/tickets/42/conversations", {
      params: { page: 1, per_page: 100 },
    });
    expect(result).toHaveLength(2);
  });

  it("auto-paginates when first page is full", async () => {
    let calls = 0;
    mockGet.mockImplementation(() => {
      calls++;
      const data = calls === 1
        ? Array(100).fill({ id: calls })
        : Array(5).fill({ id: calls });
      return Promise.resolve({ data });
    });
    const result = await getTicketConversations(1);
    expect(result).toHaveLength(105);
    expect(calls).toBe(2);
  });
});

// ─── Status / priority maps ───────────────────────────────────────────────────

describe("STATUS_MAP and PRIORITY_MAP", () => {
  it("maps all statuses to correct Freshdesk codes", () => {
    expect(STATUS_MAP).toEqual({ open: 2, pending: 3, resolved: 4, closed: 5 });
  });
  it("maps all priorities to correct Freshdesk codes", () => {
    expect(PRIORITY_MAP).toEqual({ low: 1, medium: 2, high: 3, urgent: 4 });
  });
});
