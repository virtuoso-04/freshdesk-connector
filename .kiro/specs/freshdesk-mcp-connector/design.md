# Design Document — Freshdesk MCP Connector (Production-Readiness)

## Overview

The Freshdesk MCP Connector is a Node.js/ESM package that exposes **11 read-only MCP tools** (tickets, contacts, agents) for consumption by Razorpay Agent Studio. The connector is structurally complete; this design document covers the targeted production-readiness tasks: correcting documentation inaccuracies, ensuring all tests pass, achieving internal consistency across four documentation files, and satisfying all 8 assignment requirements as a unit.

No new functional endpoints or runtime code paths are introduced by these changes — the work is partitioned into documentation corrections, configuration accuracy fixes, and verification of the existing code and test suite.

---

## Architecture

The connector follows a clean layered architecture:

```
Agent Studio / MCP Client
        │ JSON-RPC (stdio or HTTP/SSE)
        ▼
   src/index.js              ← transport selection, startup validation
        │
        ▼
   src/mcpServer.js           ← tool registry, dispatch, error normalisation
        │
        ├── src/tools/tickets.js      ← Tickets API primitives
        ├── src/tools/contacts.js     ← Contacts API primitives
        └── src/tools/agents.js       ← Agents API primitives
              │
              ▼
        src/utils/httpClient.js       ← Axios + Bottleneck + axios-retry
              │
              ▼
        Freshdesk REST API (HTTPS)
```

Supporting utilities cross-cut the tool layer:
- `src/auth/apiKey.js` — startup credential validation, Basic Auth config, API key redaction
- `src/utils/validate.js` — Zod schemas for all 11 tool inputs; `validate()` helper
- `src/utils/pagination.js` — `buildPageParams`, `fetchAllPages`
- `src/utils/logger.js` — structured JSON logger to stderr

---

## Components

### 1. Entry Point (`src/index.js`)

Handles transport selection based on the `MCP_TRANSPORT` environment variable.

- **stdio** (default): `StdioServerTransport` from `@modelcontextprotocol/sdk`
- **http**: Creates an HTTP server with `/sse` (SSE stream), `/message` (JSON-RPC post), and `/health` (liveness probe) endpoints. Session state is tracked in a `Map<sessionId, SSEServerTransport>`.

Startup validation via `buildAuthConfig()` ensures the connector fails fast with a clear error if `FRESHDESK_DOMAIN` or `FRESHDESK_API_KEY` are missing.

### 2. MCP Server (`src/mcpServer.js`)

Registers the 11 MCP tools and wires the `ListTools` and `CallTool` request handlers:

```
ListTools  → returns TOOLS array (JSON Schema definitions)
CallTool   → validate → dispatch → normalise error → MCP response
```

The three-layer pipeline for every tool call:
1. **Zod validation** (via `validate.js`) — rejects bad input as `{ code: 400 }` before any network call
2. **Domain dispatch** — calls the appropriate function in `tools/*.js`
3. **Error normalisation** — maps Axios errors and thrown objects to structured `isError` MCP responses

### 3. HTTP Client (`src/utils/httpClient.js`)

Singleton Axios instance with:
- **Bottleneck** rate limiter: `maxConcurrent = 5`, `minTime = 200 ms`
- **axios-retry**: 3 retries, exponential back-off, honours `Retry-After` header
- Request/response interceptors for structured debug logging
- `normaliseError()` maps Axios errors to `{ code, message, details? }` objects

Rate-limit defaults are intentionally conservative — 200 ms minimum delay at 5 concurrent calls yields ≈ 25 req/s, well under the 100 req/min limit on the most restrictive plan.

### 4. Authentication (`src/auth/apiKey.js`)

- Reads `FRESHDESK_DOMAIN` and `FRESHDESK_API_KEY` from environment
- Validates presence, non-placeholder value, and minimum length (10 chars)
- Returns `{ baseURL, auth: { username: apiKey, password: "X" } }` for Axios Basic Auth
- `redactApiKey()` exposes first 4 + last 4 chars only (e.g. `abcd...wxyz`)

### 5. Input Validation (`src/utils/validate.js`)

Zod schemas for every tool's input arguments, independently testable. All schemas are exported individually plus the `validate(schema, raw)` helper which throws `{ code: 400, message }` on failure.

Schemas cover: `ListTicketsSchema`, `GetTicketSchema`, `SearchTicketsSchema`, `GetConversationsSchema`, `GetContactSchema`, `ListContactsSchema`, `SearchContactsSchema`, `GetAgentSchema`, `ListAgentsSchema`.

### 6. Pagination (`src/utils/pagination.js`)

- `buildPageParams({ limit, page })` — clamps to `MAX_PAGE_SIZE=100`, `MAX_PAGE_NUMBER=300`
- `fetchAllPages(fetchFn, perPage)` — auto-paginates until a partial/empty page is returned

---

## Data Models

### Ticket (decorated)

```js
{
  id: number,
  subject: string,
  description: string,
  status: number,           // Freshdesk code: 2=open 3=pending 4=resolved 5=closed
  status_label: string,     // human-readable label added by connector
  priority: number,         // 1=low 2=medium 3=high 4=urgent
  priority_label: string,   // human-readable label added by connector
  requester_id: number,
  responder_id: number,
  group_id: number,
  tags: string[],
  created_at: string,       // ISO-8601
  updated_at: string,
  due_by: string
}
```

### Conversation

```js
{
  id: number,
  body: string,
  body_text: string,
  incoming: boolean,
  private: boolean,
  source: number,
  created_at: string,
  from_email: string,
  user_id: number
}
```

### Contact

```js
{
  id: number,
  name: string,
  email: string,
  phone: string,
  mobile: string,
  company_id: number,
  created_at: string
}
```

### Agent

```js
{
  id: number,
  contact: { name: string, email: string },
  available: boolean,
  occasional: boolean,
  ticket_scope: number
}
```

---

## Interfaces

### MCP Tool Interface (all 11 tools)

| Tool Name | Domain | Required Inputs |
|---|---|---|
| `freshdesk_list_tickets` | Tickets | none (all optional) |
| `freshdesk_get_ticket` | Tickets | `ticket_id` |
| `freshdesk_search_tickets` | Tickets | `query` |
| `freshdesk_get_conversations` | Tickets | `ticket_id` |
| `freshdesk_list_ticket_fields` | Tickets | none |
| `freshdesk_get_contact` | Contacts | `contact_id` |
| `freshdesk_list_contacts` | Contacts | none (all optional) |
| `freshdesk_search_contacts` | Contacts | `query` (min 3 chars) |
| `freshdesk_list_agents` | Agents | none (all optional) |
| `freshdesk_get_agent` | Agents | `agent_id` |
| `freshdesk_whoami` | Agents | none |

### Environment Variable Interface

| Variable | Required | Default | Validated At |
|---|---|---|---|
| `FRESHDESK_DOMAIN` | Yes | — | Startup |
| `FRESHDESK_API_KEY` | Yes | — | Startup |
| `FRESHDESK_MAX_CONCURRENT` | No | `5` | HTTP client init |
| `FRESHDESK_MIN_DELAY_MS` | No | `200` | HTTP client init |
| `MCP_TRANSPORT` | No | `stdio` | Entry point |
| `MCP_HTTP_PORT` | No | `3000` | HTTP transport |
| `LOG_LEVEL` | No | `info` | Logger init |

---

## Error Handling

All tool errors flow through a unified path:

1. **Validation errors** — thrown by `validate()` as `{ code: 400, message }` before any I/O
2. **HTTP errors** — caught in each tool function, passed to `normaliseError()` which extracts Freshdesk's `message`/`description` field, HTTP status code, and optional `errors` array
3. **MCP error responses** — the dispatcher catches both and returns `{ content: [{ type: "text", text: "Error: ..." }], isError: true }`

Rate-limit errors (`429`) are handled transparently by axios-retry before surfacing to the tool layer.

Unknown tool names result in a `{ code: 404, message: 'Unknown tool: "name"' }` thrown in the dispatcher.

---

## Production-Readiness Changes

The following targeted changes are needed to reach ship-ready state:

### REQ-1: `.env.example` rate-limit comment fix

The comment on `FRESHDESK_MIN_DELAY_MS` currently says "50 req/min" which is incorrect. It must be updated to reference the actual Freshdesk plan tiers and explain that 200 ms default (5 req/s) keeps usage within the 100 req/min limit on all plans. No variable names, default values, or other comments change.

**Change:** Replace the incorrect rate-limit comment with:
```
# Minimum delay between requests in ms (default 200 ms = 5 req/s, well within the
# 100 req/min limit on Free/Sprout and Growth plans, and even further under Pro
# (200 req/min) and Enterprise (400 req/min)).
```

### REQ-2: README project structure completeness

The project structure block is missing:
- `utils/validate.js` — Zod-based input validation for all MCP tools
- `utils/logger.js` — structured JSON logger writing to stderr
- `__tests__/contacts.test.js`, `__tests__/agents.test.js`, `__tests__/validate.test.js`

**Change:** Add these five entries to the fenced code block under "Project structure".

### REQ-4: Documentation consistency

All four documents already agree on 11 tools and the rate-limit table (Free/Sprout and Growth: 100 req/min, Pro: 200 req/min, Enterprise: 400 req/min). The `agent-capabilities.md` already contains the correct rate-limit table and the 5 concurrent / 200 ms default configuration. The Changelog references 69 tests. No cross-document contradictions exist beyond the `.env.example` comment (REQ-1) and the README project structure (REQ-2).

### REQ-5: Scope boundary documentation

The `agent-capabilities.md` "What the agent CANNOT do" table needs an explicit row for orders/inventory. It must also state:
- "orders" and "inventory" are not native Freshdesk objects
- An agent MAY infer order references from ticket custom fields, tags, or subject lines, but no dedicated order tool exists

**Change:** Add one row to the "cannot do" table and a clarifying note in the capabilities doc.

### REQ-6: Assignment requirements coverage

The documentation set already collectively addresses all 8 assignment requirements. The specific coverage gaps to close:
- Req 6.5: The example agent workflows table in `agent-capabilities.md` covers tool composition scenarios but lacks an explicit multi-step workflow narrative. A "Step-by-step example" block should be added.
- Req 6.7: The README mentions tests but does not describe the test strategy (mocked HTTP, per-module coverage). A brief "Test strategy" subsection should be added.

### REQ-7: Credential and security hygiene

Already implemented in code (`redactApiKey`, `.gitignore`, no real keys in `.env.example`). No changes needed beyond the `.env.example` comment fix in REQ-1.

### REQ-8: MCP transport configuration

Both transports are fully implemented. The README already documents both with `mcp.json` examples. No changes needed.

---

## Transport Configuration Detail

### stdio (default)

```json
{
  "mcpServers": {
    "freshdesk": {
      "command": "node",
      "args": ["/absolute/path/to/freshdesk-connector/src/index.js"],
      "env": {
        "FRESHDESK_DOMAIN": "yourcompany",
        "FRESHDESK_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### HTTP/SSE

```bash
MCP_TRANSPORT=http MCP_HTTP_PORT=3000 npm start
```

Endpoints:
- `GET /sse` — opens SSE stream, server sends `sessionId`
- `POST /message?sessionId=<id>` — routes JSON-RPC to session
- `GET /health` — returns `{ status: "ok", sessions: N }`

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: API key redaction never leaks the full key

*For any* API key string of length ≥ 10, the output of `redactApiKey(key)` shall not equal the original key and shall contain the ellipsis `"..."` separator, ensuring the full credential is never exposed in logs.

**Validates: Requirements 7.2**

---

### Property 2: Validation rejects all invalid tool inputs

*For any* set of tool arguments that violates the corresponding Zod schema (wrong type, out-of-range value, missing required field, or invalid enum), `validate(schema, args)` shall throw an error object with `code === 400` and a `message` containing `"Validation error"`.

**Validates: Requirements 3.1, 3.2**

---

### Property 3: Project structure documentation completeness

*For any* JavaScript source file present under `src/`, the filename shall appear in the README's "Project structure" fenced code block, ensuring no hidden modules exist from a documentation perspective.

**Validates: Requirements 2.4**

---

### Property 4: Tool Spec parameter coverage

*For any* parameter name defined in the Zod schemas in `src/utils/validate.js`, the corresponding tool section in `docs/mcp-tool-spec.md` shall document that parameter by name, ensuring the spec and implementation remain in sync.

**Validates: Requirements 4.5**

---

### Property 5: Rate-limit comment accuracy

*For any* reading of the `.env.example` file, the comment associated with `FRESHDESK_MIN_DELAY_MS` shall reference the correct Freshdesk rate-limit tiers (100 req/min for Free/Sprout and Growth, 200 for Pro, 400 for Enterprise) and shall not reference the incorrect value of 50 req/min.

**Validates: Requirements 1.1, 1.2**

---

### Property 6: Pagination always terminates

*For any* paginated endpoint where `fetchAllPages` is called with a `fetchPage` function that eventually returns a page shorter than `perPage`, the accumulation loop shall terminate and return the correct total number of records collected across all pages.

**Validates: Requirements 3.1** (via test suite coverage)

---

### Property 7: Ticket decoration invariant

*For any* raw ticket object with numeric `status` and `priority` fields, `decorateTicket` shall produce an object that contains both the original numeric fields and the correct human-readable `status_label` and `priority_label` strings derived from the STATUS_MAP and PRIORITY_MAP lookups.

**Validates: Requirements 3.1** (via test suite coverage)

---

### Property 8: Search query passthrough invariant

*For any* query string passed to `searchTickets`, the value forwarded to the Freshdesk `/search/tickets` endpoint as the `query` parameter shall be identical to the input string (with no added quoting wrappers), preserving field-filter syntax like `status:2 AND priority:3`.

**Validates: Requirements 3.1** (via test suite coverage)

