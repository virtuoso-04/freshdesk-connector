---
name: freshdesk-connector
description: Read-only Freshdesk MCP connector for searching tickets, customers, and knowledge base articles directly via GitHub/npx.
version: 1.0.0
author: Anant Sharma
tags:
  - freshdesk
  - customer-support
  - mcp
  - ticketing
---

# Freshdesk Read-Only Connector

## Overview
This skill connects your agent to Freshdesk via the `freshdesk-connector` MCP server hosted on GitHub (`virtuoso-04/freshdesk-connector`). It provides read-only access to query tickets, view conversations, search customer contacts, and retrieve solution articles directly inside your agent workflow without local manual installation.

## When to Use
Activate this skill when the user asks to:
- Search or inspect Freshdesk tickets by status, keyword, or requester.
- Summarize customer support ticket threads or conversation histories.
- Look up contact details or company profiles in Freshdesk.
- Search knowledge base (KB) articles and solutions.

## Setup & Configuration

Agents can execute the MCP server straight from GitHub using `npx` execution.

### Required Environment Variables
Ensure these credentials are set in the MCP server environment:
- `FRESHDESK_DOMAIN`: Your Freshdesk domain (e.g., `company.freshdesk.com`).
- `FRESHDESK_API_KEY`: Your Freshdesk API key.

### MCP Configuration Entry
Add the following snippet to your agent's MCP config file (e.g., `claude_desktop_config.json` or Cursor MCP settings):

```json
{
  "mcpServers": {
    "freshdesk": {
      "command": "npx",
      "args": ["-y", "github:virtuoso-04/freshdesk-connector"],
      "env": {
        "FRESHDESK_DOMAIN": "<your-domain>.freshdesk.com",
        "FRESHDESK_API_KEY": "<your-api-key>"
      }
    }
  }
}
