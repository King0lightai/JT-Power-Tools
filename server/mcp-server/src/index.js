/**
 * JobTread Tools Pro - MCP Server
 *
 * Universal MCP Server implementation for AI-powered JobTread access.
 * Works with Claude, ChatGPT, Gemini, Cursor, Copilot, and more.
 *
 * Endpoints:
 *   GET  /health     - Health check
 *   GET  /sse        - MCP SSE connection (for streaming clients)
 *   POST /message    - MCP HTTP message endpoint (for request/response clients)
 *
 * Auth: Bearer <license_key>:<grant_key>
 */

import { McpServer } from './mcp/server.js';
import { JobTreadTools } from './tools/jobtread.js';
import { KnowledgeLookup } from './tools/knowledge.js';
import { validateAuth, detectClientName } from './auth/index.js';
import { hasMcpAccess, hasAiKnowledge } from './config/tiers.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCors();
    }

    // Health check - no auth required
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        version: '4.0.0',
        protocol: 'MCP 2024-11-05',
        mode: 'read-only',
        features: ['knowledge-lookup', 'process-docs', 'three-tier-retrieval'],
        note: 'Read-only access for advanced users (Claude Code, Cursor, etc.)',
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // MCP SSE endpoint
    if (url.pathname === '/sse') {
      return handleMcpConnection(request, env, ctx, 'sse');
    }

    // MCP HTTP message endpoint
    if (url.pathname === '/message' && request.method === 'POST') {
      return handleMcpMessage(request, env, ctx);
    }

    // Tool listing (useful for debugging)
    if (url.pathname === '/tools') {
      return handleToolsList(request, env);
    }

    // Root - show info
    if (url.pathname === '/') {
      return new Response(JSON.stringify({
        name: 'JobTread Tools Pro MCP Server',
        version: '4.0.0',
        mode: 'read-only',
        description: 'Read-only AI-powered JobTread access for advanced users. Works with Claude Code, Cursor, ChatGPT, Gemini, and more.',
        note: 'This MCP server provides read-only access to JobTread data. Write operations require using the JobTread UI.',
        endpoints: {
          health: '/health',
          sse: '/sse',
          message: '/message',
          tools: '/tools'
        },
        auth: 'Bearer <license_key>:<grant_key>',
        docs: 'https://jobtread-tools.pro/docs/mcp'
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};

/**
 * Handle MCP connection (SSE or HTTP)
 */
async function handleMcpConnection(request, env, ctx, transport) {
  // 1. Validate authorization
  const authHeader = request.headers.get('Authorization');
  const authResult = await validateAuth(env, authHeader);

  if (!authResult.valid) {
    return new Response(JSON.stringify({
      error: authResult.error,
      code: authResult.code
    }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  const { license, user, grantKey } = authResult;

  // 2. Check tier has MCP access
  if (!hasMcpAccess(license.tier)) {
    return new Response(JSON.stringify({
      error: `Your ${license.tier} tier doesn't include MCP access. Upgrade to Power User at jobtread-tools.pro/upgrade`,
      code: 'TIER_NO_MCP'
    }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // 3. Detect client type for analytics
  const clientName = detectClientName(request);

  // 4. Create MCP server instance
  const mcpServer = new McpServer({
    name: 'jobtread-tools-pro',
    version: '4.0.0'
  });

  // 5. Create tools instance
  const tools = new JobTreadTools(env, grantKey, license, user, clientName);

  // 6. Register Knowledge Lookup tool (if tier supports it)
  if (hasAiKnowledge(license.tier)) {
    const knowledge = new KnowledgeLookup(env, license.orgId);
    tools.registerKnowledgeLookup(knowledge);
  }

  // 7. Register tools with MCP server
  mcpServer.registerTools(tools.getToolDefinitions());
  mcpServer.setToolHandler(tools.handleToolCall.bind(tools));

  // 8. Update connection stats
  ctx.waitUntil(updateConnectionStats(env, license.id, user.id, clientName));

  // 9. Return SSE stream
  return mcpServer.createSseResponse(request);
}

/**
 * Handle MCP HTTP message (POST /message)
 */
async function handleMcpMessage(request, env, ctx) {
  // 1. Validate authorization
  const authHeader = request.headers.get('Authorization');
  const authResult = await validateAuth(env, authHeader);

  if (!authResult.valid) {
    return new Response(JSON.stringify({
      error: authResult.error,
      code: authResult.code
    }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  const { license, user, grantKey } = authResult;

  // 2. Check tier has MCP access
  if (!hasMcpAccess(license.tier)) {
    return new Response(JSON.stringify({
      error: 'MCP access requires Power User tier',
      code: 'TIER_NO_MCP'
    }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // 3. Create MCP server and tools
  const clientName = detectClientName(request);
  const mcpServer = new McpServer({ name: 'jobtread-tools-pro', version: '4.0.0' });
  const tools = new JobTreadTools(env, grantKey, license, user, clientName);

  if (hasAiKnowledge(license.tier)) {
    const knowledge = new KnowledgeLookup(env, license.orgId);
    tools.registerKnowledgeLookup(knowledge);
  }

  mcpServer.registerTools(tools.getToolDefinitions());
  mcpServer.setToolHandler(tools.handleToolCall.bind(tools));

  // 4. Handle the message
  return mcpServer.handleHttpMessage(request);
}

/**
 * Handle tools list request (for debugging)
 */
async function handleToolsList(request, env) {
  const authHeader = request.headers.get('Authorization');
  const authResult = await validateAuth(env, authHeader);

  if (!authResult.valid) {
    return new Response(JSON.stringify({
      error: authResult.error,
      code: authResult.code
    }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  const { license, user, grantKey } = authResult;
  const tools = new JobTreadTools(env, grantKey, license, user, 'debug');

  if (hasAiKnowledge(license.tier)) {
    const knowledge = new KnowledgeLookup(env, license.orgId);
    tools.registerKnowledgeLookup(knowledge);
  }

  const toolDefs = tools.getToolDefinitions();

  return new Response(JSON.stringify({
    tier: license.tier,
    toolCount: toolDefs.length,
    tools: toolDefs.map(t => ({
      name: t.name,
      description: t.description
    }))
  }, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

/**
 * Update connection statistics
 */
async function updateConnectionStats(env, licenseId, userId, clientName) {
  try {
    await env.DB.prepare(`
      INSERT INTO mcp_connections (license_id, user_id, client_name, connected_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(licenseId, userId, clientName).run();
  } catch (e) {
    // Table might not exist yet - that's OK
    console.error('Connection stats update failed:', e);
  }
}

/**
 * Handle CORS preflight
 */
function handleCors() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}
