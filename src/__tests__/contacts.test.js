/**
 * Tests for tools/contacts.js
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

const mockGet = jest.fn();
jest.unstable_mockModule("../utils/httpClient.js", () => ({
  getHttpClient: () => ({ get: mockGet }),
  normaliseError: (err) => err,
}));

const { getContact, listContacts, searchContacts } = await import("../tools/contacts.js");

describe("getContact", () => {
  beforeEach(() => mockGet.mockReset());

  it("calls /contacts/:id", async () => {
    mockGet.mockResolvedValue({ data: { id: 1, name: "Alice" } });
    const result = await getContact(1);
    expect(mockGet).toHaveBeenCalledWith("/contacts/1");
    expect(result.name).toBe("Alice");
  });

  it("propagates normalised errors", async () => {
    mockGet.mockRejectedValue({ code: 404, message: "Not Found." });
    await expect(getContact(999)).rejects.toMatchObject({ code: 404 });
  });
});

describe("listContacts", () => {
  beforeEach(() => mockGet.mockReset());

  it("calls /contacts with default page params", async () => {
    mockGet.mockResolvedValue({ data: [] });
    const result = await listContacts();
    expect(mockGet).toHaveBeenCalledWith("/contacts", {
      params: expect.objectContaining({ page: 1, per_page: 30 }),
    });
    expect(result.contacts).toEqual([]);
    expect(result.total_on_page).toBe(0);
  });

  it("passes email filter through", async () => {
    mockGet.mockResolvedValue({ data: [{ id: 5, email: "user@test.com" }] });
    await listContacts({ email: "user@test.com" });
    expect(mockGet).toHaveBeenCalledWith("/contacts", {
      params: expect.objectContaining({ email: "user@test.com" }),
    });
  });

  it("returns total_on_page equal to array length", async () => {
    mockGet.mockResolvedValue({ data: [{ id: 1 }, { id: 2 }, { id: 3 }] });
    const result = await listContacts();
    expect(result.total_on_page).toBe(3);
  });
});

describe("searchContacts", () => {
  beforeEach(() => mockGet.mockReset());

  it("rejects query shorter than 3 chars", async () => {
    await expect(searchContacts("ab")).rejects.toMatchObject({ code: 400 });
  });

  it("calls /contacts/autocomplete with trimmed term", async () => {
    mockGet.mockResolvedValue({ data: [{ id: 1 }] });
    await searchContacts("  ali  ");
    expect(mockGet).toHaveBeenCalledWith("/contacts/autocomplete", {
      params: { term: "ali" },
    });
  });

  it("returns an empty array when data is not an array", async () => {
    mockGet.mockResolvedValue({ data: null });
    const result = await searchContacts("ali");
    expect(result).toEqual([]);
  });
});
