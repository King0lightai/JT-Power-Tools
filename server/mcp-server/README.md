# JobTread Tools Pro - MCP Server

Universal MCP (Model Context Protocol) server for AI-powered JobTread access. Works with Claude, ChatGPT, Gemini CLI, Cursor, Copilot, and any MCP-compatible AI platform.

## Quick Start

### 1. Install dependencies

```bash
cd server/mcp-server
npm install
```

### 2. Set up secrets

```bash
# Gemini API key for official documentation lookup
wrangler secret put GEMINI_API_KEY
```

### 3. Run database migrations

```bash
# Update existing users database
wrangler d1 execute jobtread-extension-users --file=./schema-updates.sql

# Create AI knowledge database tables
wrangler d1 execute jobtread-ai-knowledge --file=./schema-ai-knowledge.sql
```

### 4. Deploy

```bash
# Staging
wrangler deploy --env staging

# Production
wrangler deploy --env production
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Server info |
| `/health` | GET | Health check |
| `/sse` | GET | MCP SSE connection |
| `/message` | POST | MCP HTTP message |
| `/tools` | GET | List available tools |

## Authentication

All endpoints (except `/` and `/health`) require authentication:

```
Authorization: Bearer <license_key>:<grant_key>
```

- **license_key**: Your Gumroad license key
- **grant_key**: Your JobTread API grant key

## Available Tools

### Core Tools
- `jobtread_search_jobs` - Search for jobs
- `jobtread_get_job` - Get job details
- `jobtread_list_tasks` - List tasks
- `jobtread_create_task` - Create a task
- `jobtread_update_task` - Update a task
- `jobtread_get_budget` - Get job budget
- `jobtread_search_contacts` - Search contacts
- `jobtread_create_contact` - Create a contact
- `jobtread_get_custom_fields` - Get custom field definitions
- `jobtread_raw_query` - Execute raw Pave queries

### Knowledge Tool (Power User tier)
- `jobtread_knowledge_lookup` - Query documentation and process library

## Client Configuration

### Claude Desktop / Claude Code

```json
{
  "mcpServers": {
    "jobtread": {
      "type": "http",
      "url": "https://mcp.jobtread-tools.pro/message",
      "headers": {
        "Authorization": "Bearer YOUR_LICENSE_KEY:YOUR_GRANT_KEY"
      }
    }
  }
}
```

### ChatGPT / Other Clients

Use SSE endpoint:
```
URL: https://mcp.jobtread-tools.pro/sse
Auth: Bearer YOUR_LICENSE_KEY:YOUR_GRANT_KEY
```

## Architecture

```
┌──────────────────────────────────────┐
│         MCP Server (Worker)          │
├──────────────────────────────────────┤
│  src/index.js          Entry point   │
│  src/auth/             Auth module   │
│  src/config/           Tier config   │
│  src/mcp/              MCP protocol  │
│  src/tools/            Tool handlers │
└──────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────┐
│         Cloudflare Bindings          │
├──────────────────────────────────────┤
│  DB (D1)           License validation│
│  AI_KNOWLEDGE_DB   Process docs      │
│  CACHE (KV)        Response caching  │
└──────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────┐
│         External APIs                │
├──────────────────────────────────────┤
│  JobTread Pave API   User data       │
│  Gemini API          Official docs   │
└──────────────────────────────────────┘
```

## Tier Features

| Feature | Essential | Pro | Power User |
|---------|-----------|-----|------------|
| MCP Access | ❌ | ❌ | ✅ |
| AI Knowledge Lookup | ❌ | ❌ | ✅ |
| Team Docs Query | ❌ | ❌ | ✅ |
| Community Docs Query | ❌ | ❌ | ✅ |

## Development

```bash
# Run locally
wrangler dev

# View logs
wrangler tail

# Run D1 queries locally
wrangler d1 execute jobtread-extension-users --local --command "SELECT * FROM users"
```

## Error Codes

| Code | Description |
|------|-------------|
| `NO_AUTH` | Missing Authorization header |
| `INVALID_AUTH_FORMAT` | Invalid header format |
| `INVALID_LICENSE` | License not found |
| `LICENSE_EXPIRED` | License expired |
| `INVALID_GRANT_KEY` | Grant key validation failed |
| `ORG_MISMATCH` | Grant key org doesn't match license |
| `TIER_NO_MCP` | Tier doesn't include MCP access |
