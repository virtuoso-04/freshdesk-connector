# Requirements Document

## Introduction

This document specifies the production-readiness requirements for the Freshdesk MCP Connector — a Node.js/JavaScript package that exposes 11 read-only MCP tools (tickets, contacts, agents) for Razorpay Agent Studio. The connector already has a working implementation; these requirements govern the polish tasks needed to reach a ship-ready state: correcting the rate-limit comment in `.env.example`, completing the README project-structure table, verifying all 69 unit tests pass, and ensuring the four documentation files (README.md, CHANGELOG.md, docs/mcp-tool-spec.md, docs/agent-capabilities.md) are internally consistent and collectively satisfy all 8 assignment requirements.

---

## Glossary

- **Connector**: The freshdesk-connector Node.js package as a whole.
- **MCP Tool**: A named, schema-validated function exposed over the Model Context Protocol that an Agent Studio agent can invoke.
- **Agent Studio**: Razorpay's agent orchestration platform that consumes MCP connectors.
- **Freshdesk API**: The REST API at `https://<domain>.freshdesk.com/api/v2` that the Connector calls.
- **Rate Limiter**: The Bottleneck instance inside `utils/httpClient.js` that throttles outbound Freshdesk API calls.
- **env.example**: The file `.env.example` at the repository root that documents all environment variables with placeholder values.
- **README**: The file `README.md` at the repository root.
- **Tool Spec**: The file `docs/mcp-tool-spec.md`.
- **Capabilities Doc**: The file `docs/agent-capabilities.md`.
- **Changelog**: The file `CHANGELOG.md`.
- **Project Structure Block**: The fenced code block in the README under the "Project structure" heading.
- **Assignment Requirements**: The 8 graded criteria the submission must satisfy.

---

## Requirements

### Requirement 1 — Rate-limit comment accuracy

**User Story:** As a developer setting up the Connector, I want the `.env.example` comment to state the correct Freshdesk rate limits per plan, so that I configure `FRESHDESK_MIN_DELAY_MS` with accurate knowledge.

#### Acceptance Criteria

1. THE env.example SHALL contain a comment for `FRESHDESK_MIN_DELAY_MS` that references the actual Freshdesk rate-limit tiers (Free/Sprout: 100 req/min, Growth: 100 req/min, Pro: 200 req/min, Enterprise: 400 req/min) rather than the incorrect value of 50 req/min.
2. WHEN a developer reads the `FRESHDESK_MIN_DELAY_MS` comment in env.example, THE env.example SHALL state that the default 200 ms delay (5 req/s) keeps usage within the 100 req/min limit on all plans, not within a 50 req/min limit.
3. THE env.example SHALL preserve all existing variable names, default values, and surrounding comments unchanged except for the rate-limit figure being corrected.

---

### Requirement 2 — README project structure completeness

**User Story:** As a developer exploring the codebase, I want the README project structure block to list every source file, so that I can navigate the repository without discovering hidden modules.

#### Acceptance Criteria

1. THE Project Structure Block SHALL include an entry for `utils/validate.js` with a brief inline description of its role (Zod-based input validation for all MCP tools).
2. THE Project Structure Block SHALL include an entry for `utils/logger.js` with a brief inline description of its role (structured JSON logger writing to stderr).
3. THE Project Structure Block SHALL include entries for `src/__tests__/contacts.test.js`, `src/__tests__/agents.test.js`, and `src/__tests__/validate.test.js`, matching the files that exist on disk.
4. WHEN the Project Structure Block is compared against the actual files in `src/`, THE README SHALL list every `.js` file present under `src/` and `src/__tests__/`.

---

### Requirement 3 — All unit tests pass

**User Story:** As a maintainer shipping the Connector, I want every Jest test to pass without modification, so that the test suite gives a reliable green signal before release.

#### Acceptance Criteria

1. WHEN `npm test` is executed in the repository root, THE Connector's test suite SHALL exit with code 0.
2. WHEN `npm test` is executed, THE test suite SHALL report zero failing tests across all six test files: `auth.test.js`, `pagination.test.js`, `tickets.test.js`, `contacts.test.js`, `agents.test.js`, and `validate.test.js`.
3. THE test suite SHALL execute without requiring a live Freshdesk account or network connection, because the HTTP client is fully mocked.

---

### Requirement 4 — Internal documentation consistency

**User Story:** As a reviewer auditing the submission, I want all four documentation files to agree on facts such as tool count, rate limits, and feature scope, so that the documentation is trustworthy as a unit.

#### Acceptance Criteria

1. THE README, Tool Spec, Capabilities Doc, and Changelog SHALL all agree that the Connector exposes exactly 11 MCP tools.
2. THE README and Capabilities Doc SHALL both reference the same Freshdesk rate-limit table (Free/Sprout and Growth: 100 req/min, Pro: 200 req/min, Enterprise: 400 req/min).
3. THE README and Capabilities Doc SHALL both state the same default Rate Limiter configuration (max 5 concurrent calls, minimum 200 ms between calls).
4. IF any document references the number of unit tests, THEN THE document SHALL state 69 tests (matching the Changelog and the actual test suite output).
5. THE Tool Spec SHALL list all 11 tools with input schemas that match the Zod schemas defined in the corresponding `src/tools/*.js` source files.

---

### Requirement 5 — Scope boundary documentation

**User Story:** As an Agent Studio developer integrating the Connector, I want the documentation to clearly state that orders and inventory are not native Freshdesk objects, so that I do not attempt to invoke non-existent tools for those domains.

#### Acceptance Criteria

1. THE Capabilities Doc SHALL contain an explicit statement that "orders" and "inventory" are not native Freshdesk objects and are therefore not exposed as MCP tools.
2. THE Capabilities Doc SHALL state that an agent MAY infer order references by reading ticket custom fields, tags, or subject lines that contain order identifiers, but that no dedicated order tool exists.
3. THE Capabilities Doc SHALL list "orders/inventory operations" in its "What the agent CANNOT do" table with the reason that these are not native Freshdesk objects.

---

### Requirement 6 — Assignment requirements coverage

**User Story:** As the grader evaluating the submission, I want the documentation set to address all 8 assignment requirements, so that no criterion is left unanswered.

#### Acceptance Criteria

1. THE documentation set (README, Tool Spec, Capabilities Doc, Changelog) SHALL collectively describe the MCP tool interface (tool names, input schemas, return types) — satisfying Assignment Requirement 1.
2. THE documentation set SHALL describe the authentication mechanism (API key via HTTP Basic Auth, environment variable configuration) — satisfying Assignment Requirement 2.
3. THE documentation set SHALL describe rate-limit handling (Bottleneck limiter, axios-retry, per-plan quota table, configurable env vars) — satisfying Assignment Requirement 3.
4. THE documentation set SHALL describe the read-only scope boundary and explicitly list what the Connector cannot do — satisfying Assignment Requirement 4.
5. THE documentation set SHALL include example agent workflows showing how tools are composed to answer realistic support questions — satisfying Assignment Requirement 5.
6. THE documentation set SHALL describe the transport options (stdio and HTTP/SSE) and how to connect Agent Studio — satisfying Assignment Requirement 6.
7. THE documentation set SHALL describe the test strategy (unit tests, mocked HTTP, no live credentials required, coverage of all modules) — satisfying Assignment Requirement 7.
8. THE documentation set SHALL include setup and configuration instructions covering all required and optional environment variables — satisfying Assignment Requirement 8.

---

### Requirement 7 — Credential and security hygiene

**User Story:** As a security reviewer examining the repository, I want the Connector to handle credentials safely at every layer, so that no real API key can accidentally be committed or logged.

#### Acceptance Criteria

1. THE env.example SHALL contain only placeholder values (not real API keys or domain names) for all credential variables.
2. THE Connector SHALL log only a redacted form of the API key (first 4 characters, ellipsis, last 4 characters) and SHALL NOT log the full key value.
3. THE .gitignore SHALL list `.env` so that a populated secrets file is never tracked by git.
4. THE README SHALL advise developers to copy `.env.example` to `.env` and keep the resulting file local (never committed).

---

### Requirement 8 — MCP transport configuration

**User Story:** As an Agent Studio operator deploying the Connector, I want the Connector to start correctly under both stdio and HTTP/SSE transports based on the `MCP_TRANSPORT` environment variable, so that I can use the appropriate transport for my deployment model.

#### Acceptance Criteria

1. WHEN `MCP_TRANSPORT` is set to `stdio` or is absent, THE Connector SHALL start the MCP server in stdio mode and emit a ready message to stderr.
2. WHEN `MCP_TRANSPORT` is set to `http`, THE Connector SHALL start an HTTP server on the port specified by `MCP_HTTP_PORT` (default 3000) and expose `/sse` and `/message` endpoints.
3. WHEN `MCP_TRANSPORT` is set to `http`, THE Connector SHALL expose a `/health` endpoint that returns a 200 response, enabling liveness probes.
4. THE README SHALL document both transport modes with concrete configuration examples for Agent Studio's `mcp.json`.
