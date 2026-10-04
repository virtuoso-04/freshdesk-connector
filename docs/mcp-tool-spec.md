# Freshdesk Connector – MCP Tool Specification

Version: 1.0.0  
Transport: stdio (default) or HTTP/SSE

---

## Overview

This document is the authoritative specification for every MCP tool exposed by the Freshdesk Connector.  
Each tool follows the [Model Context Protocol](https://modelcontextprotocol.io) schema: a `name`, a human-readable `description`, and a JSON Schema `inputSchema`.

---

## Tools

### 1. `freshdesk_list_tickets`

List Freshdesk support tickets with optional filters and pagination.

**Input schema**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `status` | `string` | No | — | Filter by status: `open`, `pending`, `resolved`, `closed` |
| `priority` | `string` | No | — | Filter by priority: `low`, `medium`, `high`, `urgent` |
| `email` | `string` | No | — | Filter by requester email address |
| `updated_since` | `string` | No | — | ISO-8601 datetime; return tickets updated on or after this time |
| `order_by` | `string` | No | `created_at` | Sort field: `created_at`, `due_by`, `updated_at`, `status` |
| `order_type` | `string` | No | `desc` | Sort direction: `asc` or `desc` |
| `page` | `integer` | No | `1` | Page number (1–300) |
| `limit` | `integer` | No | `30` | Records per page (1–100) |

**Returns** `{ tickets: Ticket[], total_on_page: number }`

---

### 2. `freshdesk_get_ticket`

Fetch a single ticket by its numeric ID.

**Input schema**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `ticket_id` | `integer` | **Yes** | — | Freshdesk ticket ID |
| `include_conversations` | `boolean` | No | `false` | Embed conversation thread |
| `include_requester` | `boolean` | No | `false` | Embed requester contact |
| `include_stats` | `boolean` | No | `false` | Embed SLA stats |

**Returns** `Ticket` (with optional embedded objects)

---

### 3. `freshdesk_search_tickets`

Full-text and field search using Freshdesk's Search API.

**Input schema**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `query` | `string` | **Yes** | — | Freshdesk search query (see syntax below) |
| `page` | `integer` | No | `1` | Result page (1–10; Freshdesk caps search at 10 pages / 1 000 results) |

**Query syntax examples**

```
"billing"                             # free-text match on all fields
subject:"payment failed"             # subject contains phrase
status:2 AND priority:3              # numeric field filters (open + high)
tag:"vip"                            # tag filter
created_at:>2024-01-01              # date comparison
agent_id:12345 AND status:2         # assigned to agent, open
```

**Returns** `{ tickets: Ticket[], total: number, page: number }`

---

### 4. `freshdesk_get_conversations`

Fetch every reply and private/public note attached to a ticket.  
Automatically paginates to retrieve all conversations.

**Input schema**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `ticket_id` | `integer` | **Yes** | Freshdesk ticket ID |

**Returns** `Conversation[]`

---

### 5. `freshdesk_list_ticket_fields`

Return metadata about all ticket fields, including custom fields created in your portal.

**Input schema** — no parameters.

**Returns** `TicketField[]`  
Each field includes `name`, `label`, `field_type`, and `choices` (for dropdown fields).

---

### 6. `freshdesk_get_contact`

Fetch a single contact (customer / requester) by their numeric ID.

**Input schema**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `contact_id` | `integer` | **Yes** | Freshdesk contact ID |

**Returns** `Contact`

---

### 7. `freshdesk_list_contacts`

List contacts with optional filtering.

**Input schema**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `email` | `string` | No | — | Exact email match |
| `mobile` | `string` | No | — | Mobile number match |
| `phone` | `string` | No | — | Phone number match |
| `updated_since` | `string` | No | — | ISO-8601 datetime |
| `page` | `integer` | No | `1` | Page number |
| `limit` | `integer` | No | `30` | Records per page (1–100) |

**Returns** `{ contacts: Contact[], total_on_page: number }`

---

### 8. `freshdesk_search_contacts`

Autocomplete search for contacts by name, email, phone, or mobile.

**Input schema**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | **Yes** | Search term (minimum 3 characters) |

**Returns** `Contact[]`

---

### 9. `freshdesk_list_agents`

List all support agents in the Freshdesk portal.

**Input schema**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `email` | `string` | No | — | Filter by agent email |
| `page` | `integer` | No | `1` | Page number |
| `limit` | `integer` | No | `30` | Records per page (1–100) |

**Returns** `Agent[]`

---

### 10. `freshdesk_get_agent`

Fetch a single agent by their numeric ID.

**Input schema**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `agent_id` | `integer` | **Yes** | Freshdesk agent ID |

**Returns** `Agent`

---

### 11. `freshdesk_whoami`

Return the agent profile associated with the authenticated API key.

**Input schema** — no parameters.

**Returns** `Agent`

---

## Common Response Types

### Ticket

```jsonc
{
  "id": 123,
  "subject": "Cannot log in to portal",
  "description": "...",
  "status": 2,
  "status_label": "open",       // added by connector
  "priority": 3,
  "priority_label": "high",     // added by connector
  "requester_id": 45678,
  "responder_id": 9012,
  "group_id": 3456,
  "tags": ["billing", "vip"],
  "created_at": "2024-03-01T10:00:00Z",
  "updated_at": "2024-03-02T11:30:00Z",
  "due_by": "2024-03-03T18:00:00Z"
}
```

### Conversation

```jsonc
{
  "id": 789,
  "body": "Hi, I tried resetting my password...",
  "body_text": "Hi, I tried resetting my password...",
  "incoming": true,
  "private": false,
  "source": 0,
  "created_at": "2024-03-01T10:05:00Z",
  "from_email": "user@example.com",
  "user_id": 45678
}
```

### Contact

```jsonc
{
  "id": 45678,
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+1-555-0100",
  "mobile": "+1-555-0101",
  "company_id": 1234,
  "created_at": "2023-06-15T08:00:00Z"
}
```

### Agent

```jsonc
{
  "id": 9012,
  "contact": {
    "name": "Support Bot",
    "email": "support@acme.com"
  },
  "available": true,
  "occasional": false,
  "ticket_scope": 1
}
```

---

## Error Responses

All tools return structured errors:

```jsonc
{
  "isError": true,
  "content": [{ "type": "text", "text": "Error: Not Found." }]
}
```

Common error codes:

| HTTP Status | Meaning |
|---|---|
| 400 | Bad request — invalid parameters |
| 401 | Unauthorised — check API key |
| 403 | Forbidden — API key lacks permission |
| 404 | Resource not found |
| 429 | Rate limit exceeded — connector retries automatically |
| 5xx | Freshdesk server error — connector retries automatically |
