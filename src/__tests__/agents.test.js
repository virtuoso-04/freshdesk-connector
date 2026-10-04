/**
 * Tests for tools/agents.js
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

const mockGet = jest.fn();
jest.unstable_mockModule("../utils/httpClient.js", () => ({
  getHttpClient: () => ({ get: mockGet }),
  normaliseError: (err) => err,
}));

const { getAgent, listAgents, getCurrentAgent } = await import("../tools/agents.js");

describe("getAgent", () => {
  beforeEach(() => mockGet.mockReset());

  it("calls /agents/:id", async () => {
    mockGet.mockResolvedValue({ data: { id: 7, contact: { name: "Bob" } } });
    const result = await getAgent(7);
    expect(mockGet).toHaveBeenCalledWith("/agents/7");
    expect(result.id).toBe(7);
  });

  it("propagates errors", async () => {
    mockGet.mockRejectedValue({ code: 404, message: "Not Found." });
    await expect(getAgent(999)).rejects.toMatchObject({ code: 404 });
  });
});

describe("listAgents", () => {
  beforeEach(() => mockGet.mockReset());

  it("calls /agents without params by default", async () => {
    mockGet.mockResolvedValue({ data: [{ id: 1 }, { id: 2 }] });
    const result = await listAgents();
    expect(mockGet).toHaveBeenCalledWith("/agents", { params: {} });
    expect(result).toHaveLength(2);
  });

  it("passes email filter", async () => {
    mockGet.mockResolvedValue({ data: [] });
    await listAgents({ email: "agent@acme.com" });
    expect(mockGet).toHaveBeenCalledWith("/agents", {
      params: expect.objectContaining({ email: "agent@acme.com" }),
    });
  });

  it("caps per_page at 100", async () => {
    mockGet.mockResolvedValue({ data: [] });
    await listAgents({ limit: 500 });
    const [, opts] = mockGet.mock.calls[0];
    expect(opts.params.per_page).toBe(100);
  });

  it("returns empty array when data is not an array", async () => {
    mockGet.mockResolvedValue({ data: null });
    const result = await listAgents();
    expect(result).toEqual([]);
  });
});

describe("getCurrentAgent", () => {
  beforeEach(() => mockGet.mockReset());

  it("calls /agents/me", async () => {
    mockGet.mockResolvedValue({ data: { id: 1, contact: { name: "Me" } } });
    const result = await getCurrentAgent();
    expect(mockGet).toHaveBeenCalledWith("/agents/me");
    expect(result.id).toBe(1);
  });
});
