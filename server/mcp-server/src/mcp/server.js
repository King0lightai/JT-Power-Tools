/**
 * MCP Protocol Server Implementation
 * Implements Model Context Protocol (MCP) 2024-11-05 spec
 *
 * Supports both SSE (Server-Sent Events) and HTTP transports
 */

const MCP_VERSION = '2024-11-05';

export class McpServer {
  constructor(options = {}) {
    this.name = options.name || 'jobtread-tools-pro';
    this.version = options.version || '4.0.0';
    this.tools = [];
    this.toolHandler = null;
    this.resources = [];
    this.prompts = [];
  }

  /**
   * Register tool definitions
   */
  registerTools(tools) {
    this.tools = tools;
  }

  /**
   * Set the tool call handler
   */
  setToolHandler(handler) {
    this.toolHandler = handler;
  }

  /**
   * Register resources (for future use)
   */
  registerResources(resources) {
    this.resources = resources;
  }

  /**
   * Register prompts (for future use)
   */
  registerPrompts(prompts) {
    this.prompts = prompts;
  }

  /**
   * Handle MCP JSON-RPC message
   */
  async handleMessage(message) {
    const { jsonrpc, id, method, params } = message;

    if (jsonrpc !== '2.0') {
      return this.errorResponse(id, -32600, 'Invalid JSON-RPC version');
    }

    try {
      switch (method) {
        case 'initialize':
          return this.handleInitialize(id, params);

        case 'initialized':
          // Client acknowledgment - no response needed
          return null;

        case 'tools/list':
          return this.handleToolsList(id);

        case 'tools/call':
          return await this.handleToolsCall(id, params);

        case 'resources/list':
          return this.handleResourcesList(id);

        case 'resources/read':
          return this.handleResourcesRead(id, params);

        case 'prompts/list':
          return this.handlePromptsList(id);

        case 'prompts/get':
          return this.handlePromptsGet(id, params);

        case 'ping':
          return this.successResponse(id, {});

        default:
          return this.errorResponse(id, -32601, `Method not found: ${method}`);
      }
    } catch (error) {
      console.error('MCP message handler error:', error);
      return this.errorResponse(id, -32603, error.message);
    }
  }

  /**
   * Handle initialize request
   */
  handleInitialize(id, params) {
    return this.successResponse(id, {
      protocolVersion: MCP_VERSION,
      capabilities: {
        tools: { listChanged: false },
        resources: { subscribe: false, listChanged: false },
        prompts: { listChanged: false }
      },
      serverInfo: {
        name: this.name,
        version: this.version
      }
    });
  }

  /**
   * Handle tools/list request
   */
  handleToolsList(id) {
    return this.successResponse(id, {
      tools: this.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }))
    });
  }

  /**
   * Handle tools/call request
   */
  async handleToolsCall(id, params) {
    const { name, arguments: args } = params;

    if (!this.toolHandler) {
      return this.errorResponse(id, -32603, 'No tool handler registered');
    }

    const tool = this.tools.find(t => t.name === name);
    if (!tool) {
      return this.errorResponse(id, -32602, `Unknown tool: ${name}`);
    }

    try {
      const result = await this.toolHandler(name, args || {});

      // Format result as MCP content
      const content = this.formatToolResult(result);

      return this.successResponse(id, {
        content,
        isError: false
      });
    } catch (error) {
      console.error(`Tool ${name} error:`, error);
      return this.successResponse(id, {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`
        }],
        isError: true
      });
    }
  }

  /**
   * Format tool result as MCP content array
   */
  formatToolResult(result) {
    if (typeof result === 'string') {
      return [{ type: 'text', text: result }];
    }

    if (result && typeof result === 'object') {
      // If it has a 'combined' field (knowledge lookup), use that
      if (result.combined) {
        return [{ type: 'text', text: result.combined }];
      }

      // Otherwise serialize as JSON
      return [{ type: 'text', text: JSON.stringify(result, null, 2) }];
    }

    return [{ type: 'text', text: String(result) }];
  }

  /**
   * Handle resources/list request
   */
  handleResourcesList(id) {
    return this.successResponse(id, {
      resources: this.resources.map(r => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mimeType: r.mimeType
      }))
    });
  }

  /**
   * Handle resources/read request
   */
  handleResourcesRead(id, params) {
    const { uri } = params;
    const resource = this.resources.find(r => r.uri === uri);

    if (!resource) {
      return this.errorResponse(id, -32602, `Resource not found: ${uri}`);
    }

    // For now, return empty content (implement later)
    return this.successResponse(id, {
      contents: [{
        uri,
        mimeType: resource.mimeType || 'text/plain',
        text: ''
      }]
    });
  }

  /**
   * Handle prompts/list request
   */
  handlePromptsList(id) {
    return this.successResponse(id, {
      prompts: this.prompts.map(p => ({
        name: p.name,
        description: p.description,
        arguments: p.arguments
      }))
    });
  }

  /**
   * Handle prompts/get request
   */
  handlePromptsGet(id, params) {
    const { name } = params;
    const prompt = this.prompts.find(p => p.name === name);

    if (!prompt) {
      return this.errorResponse(id, -32602, `Prompt not found: ${name}`);
    }

    return this.successResponse(id, {
      description: prompt.description,
      messages: prompt.messages || []
    });
  }

  /**
   * Create JSON-RPC success response
   */
  successResponse(id, result) {
    return {
      jsonrpc: '2.0',
      id,
      result
    };
  }

  /**
   * Create JSON-RPC error response
   */
  errorResponse(id, code, message, data = null) {
    const error = { code, message };
    if (data) error.data = data;

    return {
      jsonrpc: '2.0',
      id,
      error
    };
  }

  /**
   * Create SSE response for streaming MCP connection
   */
  createSseResponse(request) {
    const encoder = new TextEncoder();

    // Generate session ID
    const sessionId = crypto.randomUUID();

    // Create readable stream for SSE
    const stream = new ReadableStream({
      start: (controller) => {
        // Send initial connection message
        const initMessage = {
          jsonrpc: '2.0',
          method: 'connection/ready',
          params: {
            sessionId,
            serverInfo: {
              name: this.name,
              version: this.version
            }
          }
        };

        controller.enqueue(encoder.encode(`data: ${JSON.stringify(initMessage)}\n\n`));
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Session-Id': sessionId
      }
    });
  }

  /**
   * Handle HTTP POST message (alternative to SSE)
   */
  async handleHttpMessage(request) {
    try {
      const message = await request.json();
      const response = await this.handleMessage(message);

      if (response === null) {
        return new Response(null, { status: 204 });
      }

      return new Response(JSON.stringify(response), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error'
        }
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
}
