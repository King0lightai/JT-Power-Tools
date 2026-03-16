/**
 * context-tools.js — MCP tool definitions for context-mode integration.
 *
 * These tools extend the existing JobTread MCP server with context-aware
 * capabilities: knowledge base search, batch execution, intent filtering,
 * session stats, and session resume.
 *
 * Tool naming convention: ctx_* prefix to distinguish from existing tools.
 */

import { ContentStore } from './store.js';
import { SessionStore, EventPriority } from './session.js';
import { ContextStats } from './stats.js';
import { applyIntentFilter } from './intent-filter.js';
import { smartTruncate, truncateJSON, byteLength } from './truncate.js';

// ─────────────────────────────────────────────────────────
// Tool Definitions (MCP format)
// ─────────────────────────────────────────────────────────

/**
 * Get all context-mode tool definitions for MCP registration.
 * @returns {Array<{name: string, description: string, inputSchema: object}>}
 */
export function getContextToolDefinitions() {
  return [
    {
      name: 'ctx_search',
      description:
        'Search the indexed knowledge base using BM25-ranked full-text search. ' +
        'Supports natural language queries with fuzzy matching fallback. ' +
        'Use this to find specific information without dumping entire responses into context. ' +
        'Accepts multiple queries in a single call for efficiency.',
      inputSchema: {
        type: 'object',
        properties: {
          queries: {
            type: 'array',
            items: { type: 'string' },
            description: 'One or more search queries to run against the knowledge base',
          },
          source: {
            type: 'string',
            description: 'Optional: filter results to a specific source label',
          },
          limit: {
            type: 'number',
            description: 'Max results per query (default: 3)',
            default: 3,
          },
        },
        required: ['queries'],
      },
    },
    {
      name: 'ctx_index',
      description:
        'Index content into the knowledge base for later search. ' +
        'Chunks markdown by headings, preserves code blocks, and builds vocabulary. ' +
        'Use this to store large documents, API responses, or documentation ' +
        'that you need to reference later without keeping it all in context.',
      inputSchema: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The content to index (markdown, plain text, or JSON)',
          },
          label: {
            type: 'string',
            description: 'A label for this content (e.g., "budget-report", "api-docs")',
          },
          content_type: {
            type: 'string',
            enum: ['markdown', 'plain', 'json'],
            description: 'Content type hint (default: auto-detect)',
          },
        },
        required: ['content', 'label'],
      },
    },
    {
      name: 'ctx_batch',
      description:
        'Execute multiple MCP tool calls in a single request and optionally ' +
        'search the knowledge base in the same call. Reduces round-trips and ' +
        'context overhead. Each command specifies a tool name and parameters. ' +
        'Results are returned with section labels.',
      inputSchema: {
        type: 'object',
        properties: {
          commands: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tool: {
                  type: 'string',
                  description: 'Name of the MCP tool to call',
                },
                params: {
                  type: 'object',
                  description: 'Parameters for the tool call',
                },
                label: {
                  type: 'string',
                  description: 'Section label for the result',
                },
                intent: {
                  type: 'string',
                  description: 'Optional intent for filtering large responses',
                },
              },
              required: ['tool', 'params'],
            },
            description: 'Array of tool calls to execute',
          },
          searches: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional search queries to run after commands',
          },
        },
        required: ['commands'],
      },
    },
    {
      name: 'ctx_stats',
      description:
        'Show context consumption statistics for the current session. ' +
        'Displays per-tool call counts, bytes returned, bytes saved, ' +
        'and overall context savings percentage. Use this to understand ' +
        'how efficiently context is being used.',
      inputSchema: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            enum: ['text', 'json'],
            description: 'Output format (default: text)',
            default: 'text',
          },
        },
      },
    },
    {
      name: 'ctx_resume',
      description:
        'Retrieve the session resume snapshot after context compaction. ' +
        'Returns an XML summary of the session state including tool usage, ' +
        'decisions, errors, and search history. Use at the start of a ' +
        'continued session to restore context awareness.',
      inputSchema: {
        type: 'object',
        properties: {
          session_id: {
            type: 'string',
            description: 'Session ID to resume (from previous session)',
          },
        },
        required: ['session_id'],
      },
    },
    {
      name: 'ctx_sources',
      description:
        'List all content sources indexed in the knowledge base. ' +
        'Shows label, chunk count, and index date for each source.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ];
}

// ─────────────────────────────────────────────────────────
// Tool Handlers
// ─────────────────────────────────────────────────────────

/**
 * Create context-mode tool handlers bound to the given environment.
 *
 * @param {object} env
 * @param {ContentStore} env.store - Knowledge base store
 * @param {SessionStore} env.session - Session store
 * @param {ContextStats} env.stats - Context stats tracker
 * @param {string} env.orgId - Current organization ID
 * @param {string} env.sessionId - Current session ID
 * @param {Function} env.callTool - Function to call other MCP tools: (toolName, params) => response
 * @returns {Record<string, Function>}
 */
export function createContextToolHandlers(env) {
  const { store, session, stats, orgId, sessionId, callTool } = env;

  return {
    /**
     * ctx_search — BM25-ranked knowledge base search with fallback layers.
     */
    async ctx_search(params) {
      const { queries, source, limit = 3 } = params;
      const results = [];

      for (const query of queries) {
        // Record search event
        await session.insertEvent(sessionId, orgId, {
          type: 'search_query',
          category: 'mcp',
          priority: EventPriority.NORMAL,
          data: query,
        });

        const hits = await store.searchWithFallback(orgId, query, limit, source);
        results.push({
          query,
          hits: hits.map(h => ({
            title: h.title,
            content: h.content,
            source: h.source,
            matchLayer: h.matchLayer,
            ...(h.correctedQuery ? { correctedQuery: h.correctedQuery } : {}),
          })),
          count: hits.length,
        });
      }

      return { results, totalHits: results.reduce((s, r) => s + r.count, 0) };
    },

    /**
     * ctx_index — Index content into the knowledge base.
     */
    async ctx_index(params) {
      const { content, label, content_type } = params;

      let result;
      if (content_type === 'json') {
        result = await store.indexJSON(orgId, content, label);
      } else if (content_type === 'plain') {
        result = await store.indexPlainText(orgId, content, label);
      } else {
        // Auto-detect
        try {
          JSON.parse(content);
          result = await store.indexJSON(orgId, content, label);
        } catch {
          result = await store.index(orgId, content, label);
        }
      }

      return {
        indexed: true,
        label: result.label,
        chunks: result.totalChunks,
        codeChunks: result.codeChunks,
        message: `Indexed "${label}" into ${result.totalChunks} searchable chunks. Use ctx_search to query.`,
      };
    },

    /**
     * ctx_batch — Execute multiple tool calls + searches in one request.
     */
    async ctx_batch(params) {
      const { commands, searches } = params;
      const results = [];

      // Execute commands sequentially (they may depend on each other)
      for (const cmd of commands) {
        const label = cmd.label || cmd.tool;
        const startMs = Date.now();

        try {
          let response = await callTool(cmd.tool, cmd.params);
          const durationMs = Date.now() - startMs;

          // Apply intent filtering if specified
          if (cmd.intent) {
            const filtered = await applyIntentFilter({
              response,
              intent: cmd.intent,
              toolName: cmd.tool,
              orgId,
              store,
            });
            response = filtered.filtered;

            stats.record(cmd.tool, filtered.rawBytes, byteLength(response), durationMs);
          } else {
            const responseStr = typeof response === 'string' ? response : JSON.stringify(response);
            const rawBytes = byteLength(responseStr);
            // Apply smart truncation for large responses
            const truncated = smartTruncate(responseStr, 10 * 1024);
            stats.record(cmd.tool, rawBytes, byteLength(truncated), durationMs);
            response = truncated;
          }

          results.push({ label, status: 'ok', response });
        } catch (error) {
          results.push({ label, status: 'error', error: error.message });
          await session.recordError(sessionId, orgId, `${cmd.tool}: ${error.message}`);
        }
      }

      // Execute searches if provided
      let searchResults = null;
      if (searches && searches.length > 0) {
        searchResults = [];
        for (const query of searches) {
          const hits = await store.searchWithFallback(orgId, query, 2);
          searchResults.push({ query, hits, count: hits.length });
        }
      }

      return {
        commands: results,
        searches: searchResults,
        summary: `Executed ${commands.length} commands${searches ? ` + ${searches.length} searches` : ''}`,
      };
    },

    /**
     * ctx_stats — Context consumption statistics.
     */
    async ctx_stats(params) {
      const format = params?.format || 'text';

      const summary = stats.getSummary();
      const storeStats = await store.getStats(orgId);
      const sessionStats = await session.getSessionStats(sessionId);

      if (format === 'json') {
        return {
          context: summary,
          knowledgeBase: storeStats,
          session: sessionStats,
        };
      }

      // Text format
      const report = stats.formatReport();
      const kbInfo = `\n## Knowledge Base\nSources: ${storeStats.sources} | Chunks: ${storeStats.chunks} | Code chunks: ${storeStats.codeChunks} | Vocabulary: ${storeStats.vocabulary}`;
      const sessionInfo = sessionStats
        ? `\n## Session\nEvents: ${sessionStats.event_count} | Compactions: ${sessionStats.compact_count}`
        : '';

      return report + kbInfo + sessionInfo;
    },

    /**
     * ctx_resume — Retrieve session resume snapshot.
     */
    async ctx_resume(params) {
      const { session_id } = params;

      const snapshot = await session.getResumeSnapshot(session_id);
      if (!snapshot) {
        return { error: 'No resume snapshot found for this session', session_id };
      }

      return {
        snapshot,
        message: 'Session state restored. Review the snapshot above to continue where you left off.',
      };
    },

    /**
     * ctx_sources — List indexed knowledge base sources.
     */
    async ctx_sources() {
      const sources = await store.listSources(orgId);
      const storeStats = await store.getStats(orgId);

      return {
        sources,
        totals: storeStats,
      };
    },
  };
}
