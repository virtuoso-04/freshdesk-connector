/**
 * Tests for auth/apiKey.js
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { buildAuthConfig, redactApiKey } from "../auth/apiKey.js";

describe("buildAuthConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.FRESHDESK_DOMAIN = "testcompany";
    process.env.FRESHDESK_API_KEY = "abcdefghijklmnopqrst";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns correct baseURL and Basic auth config", () => {
    const config = buildAuthConfig();
    expect(config.baseURL).toBe("https://testcompany.freshdesk.com/api/v2");
    expect(config.auth.username).toBe("abcdefghijklmnopqrst");
    expect(config.auth.password).toBe("X");
  });

  it("throws when FRESHDESK_DOMAIN is missing", () => {
    delete process.env.FRESHDESK_DOMAIN;
    expect(() => buildAuthConfig()).toThrow(/FRESHDESK_DOMAIN/);
  });

  it("throws when FRESHDESK_API_KEY is missing", () => {
    delete process.env.FRESHDESK_API_KEY;
    expect(() => buildAuthConfig()).toThrow(/FRESHDESK_API_KEY/);
  });

  it("throws when FRESHDESK_API_KEY is the placeholder", () => {
    process.env.FRESHDESK_API_KEY = "your_api_key_here";
    expect(() => buildAuthConfig()).toThrow(/FRESHDESK_API_KEY/);
  });

  it("throws when FRESHDESK_API_KEY is too short", () => {
    process.env.FRESHDESK_API_KEY = "short";
    expect(() => buildAuthConfig()).toThrow(/too short/);
  });
});

describe("redactApiKey", () => {
  it("shows first and last 4 chars", () => {
    expect(redactApiKey("abcdefghijklmno12345")).toBe("abcd...2345");
  });

  it("returns *** for short keys", () => {
    expect(redactApiKey("abc")).toBe("***");
  });

  it("returns *** for empty string", () => {
    expect(redactApiKey("")).toBe("***");
  });
});
