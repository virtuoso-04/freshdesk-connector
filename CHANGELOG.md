# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/) conventions.

---

## [1.0.0] — 2026-10-02

### Added
- **11 read-only MCP tools** across tickets, contacts, and agents.
- **API-key authentication** with startup validation and redacted logging.
- **Bottleneck rate limiter** — configurable concurrency and min-delay keep
  requests within Freshdesk's per-minute quota on every plan.
- **axios-retry** — automatic exponential back-off on 429 and 5xx responses;
  honours `Retry-After` header.
- **Zod input validation** on every tool — bad arguments are rejected with a
  structured 400 error before any API call is made.
- **Structured JSON logger** (`utils/logger.js`) writing to stderr; level
  controlled by `LOG_LEVEL` env var.
- **HTTP/SSE transport** with correct per-session routing (`/sse` + `/message`)
  and a `/health` endpoint.
- **69 unit tests** covering auth, pagination, validation, tickets, contacts,
  and agents — all mocked, no real Freshdesk account required.
- `docs/mcp-tool-spec.md` — full JSON Schema specification for every tool.
- `docs/agent-capabilities.md` — plain-English guide to what the agent can
  and cannot do, with example workflows.

### Fixed
- `searchTickets` no longer wraps the user query in extra double-quotes, which
  was silently breaking structured field queries like `status:2 AND priority:3`.

### Security
- No credentials are written to stdout; API key is logged only in redacted
  form (`abcd...wxyz`).
- `.env` is `.gitignore`-d; `.env.example` contains only placeholder values.
