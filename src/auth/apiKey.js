/**
 * auth/apiKey.js
 *
 * Freshdesk uses HTTP Basic Authentication with the API key as the username
 * and the literal string "X" as the password.  The SDK docs state:
 *   Authorization: Basic base64("<api_key>:X")
 *
 * This module validates the environment at startup and returns the Axios
 * auth config object that every HTTP request must include.
 */

/**
 * Build and validate the Freshdesk auth config from environment variables.
 *
 * @returns {{ baseURL: string, auth: { username: string, password: string } }}
 * @throws {Error} when required environment variables are missing or obviously wrong.
 */
export function buildAuthConfig() {
  const domain = process.env.FRESHDESK_DOMAIN?.trim();
  const apiKey = process.env.FRESHDESK_API_KEY?.trim();

  if (!domain) {
    throw new Error(
      "FRESHDESK_DOMAIN is not set.\n" +
        "Set it to your Freshdesk subdomain (the part before .freshdesk.com).\n" +
        "Example: FRESHDESK_DOMAIN=acme"
    );
  }

  if (!apiKey || apiKey === "your_api_key_here") {
    throw new Error(
      "FRESHDESK_API_KEY is not set or is still the placeholder value.\n" +
        "Find your API key under Profile Settings → API Key in your Freshdesk portal."
    );
  }

  // Sanity-check: Freshdesk API keys are alphanumeric, typically 20+ chars.
  if (apiKey.length < 10) {
    throw new Error(
      `FRESHDESK_API_KEY looks too short (${apiKey.length} chars). ` +
        "Please double-check the value."
    );
  }

  return {
    baseURL: `https://${domain}.freshdesk.com/api/v2`,
    // Axios auth config – serialised automatically as Basic base64(user:pass)
    auth: {
      username: apiKey,
      password: "X",
    },
  };
}

/**
 * Return a redacted representation of the API key suitable for logging.
 * Shows the first 4 and last 4 characters only.
 *
 * @param {string} apiKey
 * @returns {string}
 */
export function redactApiKey(apiKey) {
  if (!apiKey || apiKey.length < 10) return "***";
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}
