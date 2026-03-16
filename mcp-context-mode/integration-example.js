/**
 * integration-example.js — How to integrate context-mode into the JobTread MCP Server.
 *
 * This file shows the pattern for adding context-mode to your existing
 * Cloudflare Workers MCP server. It's NOT a standalone Worker — it's
 * a reference for modifying your existing server code.
 *
 * Prerequisites:
 *   1. D1 database created and bound as CONTEXT_DB
 *   2. KV namespace created and bound as CONTEXT_KV
 *   3. Schema applied: wrangler d1 execute CONTEXT_DB --file=./mcp-context-mode/schema.sql
 */

import { createContextMode } from './src/index.js';

// ─────────────────────────────────────────────────────────
// Example: Adding context-mode to your MCP message handler
// ─────────────────────────────────────────────────────────

/**
 * Example MCP message handler with context-mode integration.
 *
 * This shows how to:
 * 1. Initialize context-mode per request
 * 2. Register context tools alongside existing tools
 * 3. Wrap existing tools with smart truncation + intent filtering
 * 4. Handle session continuity
 */
async function handleMCPMessage(request, env) {
  // Parse the MCP request
  const body = await request.json();
  const { method, params, id } = body;

  // Auth (your existing auth logic)
  const authHeader = request.headers.get('Authorization');
  const orgId = await authenticateAndGetOrgId(authHeader, env);
  if (!orgId) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  // ── Initialize context-mode ──
  const ctx = createContextMode(env.CONTEXT_DB, env.CONTEXT_KV);

  // Get or generate session ID (from header or create new)
  const sessionId = request.headers.get('X-Session-Id') || crypto.randomUUID();

  // Ensure session exists
  await ctx.session.ensureSession(sessionId, orgId);

  // ── Handle MCP methods ──

  if (method === 'tools/list') {
    // Return existing tools + context-mode tools
    const existingTools = getExistingToolDefinitions();
    const contextTools = ctx.getToolDefinitions();

    return jsonResponse({
      jsonrpc: '2.0',
      id,
      result: { tools: [...existingTools, ...contextTools] },
    });
  }

  if (method === 'tools/call') {
    const { name: toolName, arguments: toolArgs } = params;

    // ── Context-mode tools ──
    if (toolName.startsWith('ctx_')) {
      const handlers = ctx.createHandlers({
        orgId,
        sessionId,
        callTool: (name, args) => callExistingTool(name, args, orgId, env),
      });

      const handler = handlers[toolName];
      if (!handler) {
        return jsonResponse({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Unknown tool: ${toolName}` },
        });
      }

      const result = await handler(toolArgs);
      return jsonResponse({
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }] },
      });
    }

    // ── Existing tools (wrapped with context-mode) ──
    const wrappedHandler = ctx.wrapTool(
      toolName,
      (args) => callExistingTool(toolName, args, orgId, env),
      { orgId, sessionId }
    );

    try {
      const result = await wrappedHandler(toolArgs);
      return jsonResponse({
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }] },
      });
    } catch (error) {
      return jsonResponse({
        jsonrpc: '2.0',
        id,
        error: { code: -32000, message: error.message },
      });
    }
  }

  // ── Session management endpoints ──

  if (method === 'context/snapshot') {
    // Build resume snapshot (call before context compaction)
    const snapshot = await ctx.buildSnapshot(sessionId, orgId);
    return jsonResponse({
      jsonrpc: '2.0',
      id,
      result: { snapshot },
    });
  }

  if (method === 'context/resume') {
    // Restore session from snapshot
    const snapshot = await ctx.getSnapshot(params.session_id || sessionId);
    return jsonResponse({
      jsonrpc: '2.0',
      id,
      result: { snapshot: snapshot || 'No snapshot available' },
    });
  }

  return jsonResponse({
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  });
}

// ─────────────────────────────────────────────────────────
// Example: Adding intent parameter to existing tool schemas
// ─────────────────────────────────────────────────────────

/**
 * When context-mode is enabled, add an optional 'intent' parameter
 * to tools that can return large responses. This enables intent-driven
 * filtering automatically.
 *
 * Tools that benefit from intent filtering:
 * - get_budget / get_full_budget (can return 50KB+)
 * - search_jobs (can return many results)
 * - get_schedule / list_tasks (large schedules)
 * - get_dashboard (complex dashboard data)
 * - raw_query (arbitrary data)
 */
function addIntentToToolSchema(toolDef) {
  const largeResponseTools = [
    'jobtread_get_budget',
    'jobtread_get_full_budget',
    'jobtread_budget_tree',
    'jobtread_search_jobs',
    'jobtread_list_tasks',
    'jobtread_get_schedule',
    'jobtread_get_dashboard',
    'jobtread_raw_query',
    'jobtread_global_search',
    'jobtread_job_activity',
    'jobtread_daily_logs',
  ];

  if (largeResponseTools.includes(toolDef.name)) {
    toolDef.inputSchema.properties.intent = {
      type: 'string',
      description:
        'Optional: describe what you are looking for. When the response is large, ' +
        'only relevant sections will be returned and the full data will be indexed ' +
        'for follow-up ctx_search queries. Example: "overdue tasks", "cost overruns"',
    };
  }

  return toolDef;
}

// ─────────────────────────────────────────────────────────
// Helpers (stubs — replace with your actual implementation)
// ─────────────────────────────────────────────────────────

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function authenticateAndGetOrgId(authHeader, env) {
  // Your existing auth logic
  return 'org_example';
}

function getExistingToolDefinitions() {
  // Your existing tool definitions
  return [];
}

async function callExistingTool(name, args, orgId, env) {
  // Your existing tool dispatch logic
  return {};
}

export { handleMCPMessage, addIntentToToolSchema };
