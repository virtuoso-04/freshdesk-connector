# Freshdesk Connector: Agent Capabilities

What your Agent Studio agent can and cannot do with this connector.

---

## What the agent can do

### Read tickets

- Retrieve a paginated list of all tickets, optionally filtered by status, priority, requester email, or last-updated date.
- Fetch the full details of any ticket by ID, optionally including the full conversation thread, requester profile, and SLA stats.
- Run full-text and structured searches across tickets using Freshdesk query syntax, for example finding all open high-priority tickets tagged "billing".
- Retrieve all replies and notes on a ticket across as many pages as needed.
- Discover what ticket fields are available, including custom fields configured in your portal.

### Read contacts

- Look up a customer profile by Freshdesk contact ID.
- List contacts filtered by email, phone, or mobile number.
- Autocomplete-search contacts by name, email, or phone (minimum 3 characters).

### Read agents

- List all support agents in the portal.
- Fetch the profile of a specific agent by ID.
- Identify which agent is associated with the current API key using `freshdesk_whoami`.

---

## Example agent workflows

| Goal | Tools used |
|---|---|
| Summarise all open tickets for a customer | `freshdesk_list_tickets` (email filter) + `freshdesk_get_ticket` |
| Show the full conversation on a ticket | `freshdesk_get_conversations` |
| Find tickets mentioning "refund" in the last 7 days | `freshdesk_search_tickets` |
| Who is the agent assigned to ticket #4821? | `freshdesk_get_ticket` + `freshdesk_get_agent` |
| List all urgent open tickets for the Billing group | `freshdesk_list_tickets` + `freshdesk_search_tickets` |
| Get the contact details for a requester | `freshdesk_get_contact` |
| Verify the API key is working | `freshdesk_whoami` |

### Step-by-step example: investigate a customer complaint

A merchant asks: "What is the latest issue from user@acme.com and what did the support team say?"

1. Call `freshdesk_search_contacts` with `query: "user@acme.com"` to find the contact ID.
2. Call `freshdesk_list_tickets` with `email: "user@acme.com"` and `order_by: "updated_at"` to get their recent tickets.
3. Call `freshdesk_get_ticket` with the ID of the highest-priority open ticket to read its full details.
4. Call `freshdesk_get_conversations` with the same ticket ID to read the full reply thread between the customer and the support team.

The agent now has everything needed to give the merchant a clear, grounded answer without guessing.

---

## What the agent cannot do

| Action | Reason |
|---|---|
| Create, update, or delete tickets | The connector is intentionally read-only. No write endpoints exist, so an automated agent cannot accidentally mutate data. |
| Send replies or add notes to tickets | Same reason, no write access. |
| Create or update contacts or agents | Read-only by design. |
| Access attachments or file content | Freshdesk returns attachment metadata like URLs in ticket and conversation responses, but the connector does not fetch or proxy binary files. |
| Access admin settings | Things like products, business hours, and SLA policies are not implemented as they are rarely needed by a support agent. |
| Perform bulk operations | No bulk-update endpoints are exposed. |
| Search more than 1,000 tickets | Freshdesk's Search API caps results at 1,000 records (10 pages of 100). For larger result sets use `freshdesk_list_tickets` with pagination which supports up to 30,000 records. |
| Access tickets from other portals | The connector is tied to a single `FRESHDESK_DOMAIN`. |
| Read or manage orders or inventory | These are not native Freshdesk objects. Freshdesk has no orders or inventory concept. An agent can infer order references by reading ticket custom fields, tags, or subject lines that contain order IDs, but there are no dedicated order or inventory tools. |

---

## Authentication

The connector uses API key authentication over HTTP Basic Auth.

- The API key is set via the `FRESHDESK_API_KEY` environment variable.
- It is never transmitted except to `<your-domain>.freshdesk.com` over HTTPS.
- The connector logs only a redacted version of the key (first 4 and last 4 characters).

No OAuth flow is needed. Freshdesk's API key approach is equivalent in security for server-side connectors.

---

## Rate limiting

Freshdesk enforces per-minute request quotas that vary by plan:

| Plan | Requests per minute |
|---|---|
| Free / Sprout | 100 |
| Growth | 100 |
| Pro | 200 |
| Enterprise | 400 |

The connector is pre-configured to stay within the most restrictive limit. The defaults are max 5 concurrent requests and minimum 200 ms between requests. You can tune this with environment variables:

```
FRESHDESK_MAX_CONCURRENT=5
FRESHDESK_MIN_DELAY_MS=200
```

If Freshdesk returns a 429 Too Many Requests response the connector backs off automatically and retries up to 3 times with exponential delay, honouring the `Retry-After` header when present.

---

## Data privacy

- No ticket data, customer data, or conversation content is stored, logged, or forwarded anywhere by this connector.
- All data flows directly between the agent and the Freshdesk API over HTTPS.
- Do not commit real API keys. Use environment variables or a secrets manager.
