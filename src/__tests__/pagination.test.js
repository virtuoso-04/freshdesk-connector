/**
 * Tests for utils/pagination.js
 */

import { describe, it, expect } from "@jest/globals";
import { buildPageParams, fetchAllPages, MAX_PAGE_SIZE } from "../utils/pagination.js";

describe("buildPageParams", () => {
  it("returns defaults when no args", () => {
    const { page, per_page } = buildPageParams();
    expect(page).toBe(1);
    expect(per_page).toBe(30);
  });

  it("caps per_page at MAX_PAGE_SIZE", () => {
    const { per_page } = buildPageParams({ limit: 999 });
    expect(per_page).toBe(MAX_PAGE_SIZE);
  });

  it("clamps page to 1 minimum", () => {
    const { page } = buildPageParams({ page: 0 });
    expect(page).toBe(1);
  });

  it("clamps page to MAX_PAGE_NUMBER maximum", () => {
    const { page } = buildPageParams({ page: 9999 });
    expect(page).toBe(300);
  });

  it("passes through valid values unchanged", () => {
    const { page, per_page } = buildPageParams({ limit: 50, page: 5 });
    expect(page).toBe(5);
    expect(per_page).toBe(50);
  });
});

describe("fetchAllPages", () => {
  it("collects results from multiple pages", async () => {
    // Page 1: full (100 records), Page 2: partial (50 records) → stops
    const mockFetch = async (page) => {
      if (page === 1) return Array(100).fill({ page: 1 });
      if (page === 2) return Array(50).fill({ page: 2 });
      return [];
    };

    const results = await fetchAllPages(mockFetch, 100);
    expect(results).toHaveLength(150);
  });

  it("stops on the first empty page", async () => {
    const mockFetch = async (page) => (page === 1 ? [{ id: 1 }] : []);
    const results = await fetchAllPages(mockFetch, 100);
    expect(results).toHaveLength(1);
  });

  it("stops when page returns fewer than perPage records", async () => {
    let calls = 0;
    const mockFetch = async () => {
      calls++;
      return calls === 1 ? Array(100).fill({}) : Array(5).fill({});
    };

    const results = await fetchAllPages(mockFetch, 100);
    expect(results).toHaveLength(105);
    expect(calls).toBe(2);
  });
});
