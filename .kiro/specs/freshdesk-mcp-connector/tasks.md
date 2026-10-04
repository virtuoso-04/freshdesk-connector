# Implementation Plan: Freshdesk MCP Connector (Production-Readiness)

## Overview

The connector implementation is structurally complete. This plan covers the targeted polish tasks to reach ship-ready state: correcting a rate-limit comment, completing the README project structure block, expanding the capabilities doc with scope boundaries and a step-by-step workflow example, adding a test strategy subsection to the README, and verifying all 69 tests pass.

All changes are in documentation and configuration files; no runtime code paths are modified.

## Tasks

- [ ] 1. Fix `.env.example` rate-limit comment
  - [ ] 1.1 Replace the incorrect "50 req/min" comment on `FRESHDESK_MIN_DELAY_MS` with the correct Freshdesk per-plan rate-limit tiers
    - Open `.env.example` and locate the comment on the `FRESHDESK_MIN_DELAY_MS` line
    - Replace the comment block with: "Minimum delay between requests in ms (default 200 ms = 5 req/s, well within the 100 req/min limit on Free/Sprout and Growth plans, and even further under Pro (200 req/min) and Enterprise (400 req/min))."
    - Preserve all other variable names, default values, and surrounding comments unchanged
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 1.2 Write property test verifying the rate-limit comment references correct tiers
    - **Property 5: Rate-limit comment accuracy**
    - Read `.env.example` as a string and assert it does NOT contain "50 req/min"
    - Assert it DOES contain "100 req/min" and references "Free/Sprout", "Growth", "Pro", and "Enterprise" plan names
    - Assert `FRESHDESK_MIN_DELAY_MS=200` default value is still present
    - **Validates: Requirements 1.1, 1.2**

- [ ] 2. Complete README project structure block
  - [ ] 2.1 Add missing source files to the README "Project structure" fenced code block
    - Open `README.md` and locate the fenced code block under the "Project structure" heading
    - Add `utils/validate.js` with inline description: "Zod-based input validation for all MCP tools"
    - Add `utils/logger.js` with inline description: "Structured JSON logger writing to stderr"
    - Add `__tests__/contacts.test.js`, `__tests__/agents.test.js`, and `__tests__/validate.test.js` entries alongside the existing test file entries
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 2.2 Write property test verifying README project structure completeness
    - **Property 3: Project structure documentation completeness**
    - Read `README.md` and extract the content of the fenced code block under "Project structure"
    - For each `.js` file found under `src/` on disk, assert its filename appears in that block
    - **Validates: Requirements 2.4**

- [ ] 3. Checkpoint — verify tests still pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Expand `agent-capabilities.md` with scope boundaries and workflow example
  - [ ] 4.1 Add orders/inventory row to the "What the agent CANNOT do" table
    - Open `docs/agent-capabilities.md` and locate the "What the agent CANNOT do" table
    - Add a new row: "orders/inventory operations" with reason "Not native Freshdesk objects — Freshdesk has no orders or inventory concept. An agent MAY infer order references by reading ticket custom fields, tags, or subject lines that contain order identifiers, but no dedicated order tool exists."
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 4.2 Add step-by-step workflow example narrative to `agent-capabilities.md`
    - Under "Example agent workflows", add a "Step-by-step example" subsection after the table
    - Write a concrete multi-step narrative showing: (1) agent calls `freshdesk_search_contacts` to find a customer by email, (2) agent calls `freshdesk_list_tickets` filtered by requester, (3) agent calls `freshdesk_get_ticket` for the highest-priority ticket, (4) agent calls `freshdesk_get_conversations` to read the thread
    - _Requirements: 6.5_

- [ ] 5. Add test strategy subsection to README
  - [ ] 5.1 Add a "Test strategy" subsection under the "Running tests" section in `README.md`
    - After the `npm test` code block, add a "Test strategy" heading with a brief description covering: six test files, mocked HTTP client (no live credentials required), per-module coverage (auth, pagination, tickets, contacts, agents, validate), and property-based assertions
    - _Requirements: 6.7_

- [ ] 6. Checkpoint — run full test suite and verify 69 tests pass
  - Run `npm test` and confirm exit code 0 with zero failures across all six test files
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All changes are documentation/config only — no runtime source files are modified
- Property tests validate cross-cutting correctness properties (rate-limit accuracy, README completeness)
- The test suite requires no live Freshdesk account; the HTTP client is fully mocked
- Checkpoints ensure incremental validation at logical milestones

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "4.1", "4.2", "5.1"] },
    { "id": 1, "tasks": ["1.2", "2.2"] }
  ]
}
```
