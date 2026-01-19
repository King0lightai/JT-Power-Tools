/**
 * JobTread MCP Tools
 * Provides tool definitions and handlers for JobTread operations
 */

const JOBTREAD_API = 'https://api.jobtread.com/pave';

export class JobTreadTools {
  constructor(env, grantKey, license, user, clientName) {
    this.env = env;
    this.grantKey = grantKey;
    this.license = license;
    this.user = user;
    this.orgId = license.orgId;
    this.clientName = clientName;
    this.knowledgeLookup = null;
  }

  /**
   * Register knowledge lookup handler
   */
  registerKnowledgeLookup(knowledge) {
    this.knowledgeLookup = knowledge;
  }

  /**
   * Get all tool definitions
   */
  getToolDefinitions() {
    const tools = [
      // Search Jobs
      {
        name: 'jobtread_search_jobs',
        description: 'Search for jobs by name, number, or status. Returns a list of matching jobs.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search term to match against job name or number'
            },
            status: {
              type: 'string',
              enum: ['lead', 'opportunity', 'committed', 'active', 'completed', 'closed'],
              description: 'Filter by job status'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results (default 20, max 100)'
            }
          }
        }
      },

      // Get Job Details
      {
        name: 'jobtread_get_job',
        description: 'Get detailed information about a specific job including budget, tasks, and custom fields.',
        inputSchema: {
          type: 'object',
          properties: {
            jobId: {
              type: 'string',
              description: 'The JobTread job ID'
            }
          },
          required: ['jobId']
        }
      },

      // List Tasks
      {
        name: 'jobtread_list_tasks',
        description: 'List tasks for a specific job or across all jobs.',
        inputSchema: {
          type: 'object',
          properties: {
            jobId: {
              type: 'string',
              description: 'Optional job ID to filter tasks'
            },
            status: {
              type: 'string',
              enum: ['pending', 'in_progress', 'completed'],
              description: 'Filter by task status'
            },
            assigneeEmail: {
              type: 'string',
              description: 'Filter by assignee email'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results (default 50)'
            }
          }
        }
      },

      // Create Task
      {
        name: 'jobtread_create_task',
        description: 'Create a new task on a job.',
        inputSchema: {
          type: 'object',
          properties: {
            jobId: {
              type: 'string',
              description: 'Job ID to create task on'
            },
            name: {
              type: 'string',
              description: 'Task name/title'
            },
            description: {
              type: 'string',
              description: 'Task description'
            },
            startDate: {
              type: 'string',
              description: 'Start date (YYYY-MM-DD)'
            },
            endDate: {
              type: 'string',
              description: 'End date (YYYY-MM-DD)'
            },
            assigneeEmails: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of assignee email addresses'
            }
          },
          required: ['jobId', 'name']
        }
      },

      // Update Task
      {
        name: 'jobtread_update_task',
        description: 'Update an existing task.',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'Task ID to update'
            },
            name: {
              type: 'string',
              description: 'New task name'
            },
            description: {
              type: 'string',
              description: 'New task description'
            },
            status: {
              type: 'string',
              enum: ['pending', 'in_progress', 'completed'],
              description: 'New task status'
            },
            startDate: {
              type: 'string',
              description: 'New start date (YYYY-MM-DD)'
            },
            endDate: {
              type: 'string',
              description: 'New end date (YYYY-MM-DD)'
            }
          },
          required: ['taskId']
        }
      },

      // Get Budget
      {
        name: 'jobtread_get_budget',
        description: 'Get budget information for a job including cost codes, line items, and totals.',
        inputSchema: {
          type: 'object',
          properties: {
            jobId: {
              type: 'string',
              description: 'Job ID to get budget for'
            }
          },
          required: ['jobId']
        }
      },

      // Search Contacts
      {
        name: 'jobtread_search_contacts',
        description: 'Search for contacts/customers by name, email, or phone.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search term'
            },
            type: {
              type: 'string',
              enum: ['customer', 'vendor', 'subcontractor', 'all'],
              description: 'Contact type filter (default: all)'
            },
            limit: {
              type: 'number',
              description: 'Maximum results (default 20)'
            }
          }
        }
      },

      // Create Contact
      {
        name: 'jobtread_create_contact',
        description: 'Create a new contact (customer, vendor, or subcontractor).',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Contact name'
            },
            email: {
              type: 'string',
              description: 'Email address'
            },
            phone: {
              type: 'string',
              description: 'Phone number'
            },
            type: {
              type: 'string',
              enum: ['customer', 'vendor', 'subcontractor'],
              description: 'Contact type'
            },
            address: {
              type: 'object',
              properties: {
                street: { type: 'string' },
                city: { type: 'string' },
                state: { type: 'string' },
                zip: { type: 'string' }
              },
              description: 'Contact address'
            }
          },
          required: ['name', 'type']
        }
      },

      // Get Custom Fields
      {
        name: 'jobtread_get_custom_fields',
        description: 'Get custom field definitions for jobs in the organization.',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },

      // Raw Query (advanced)
      {
        name: 'jobtread_raw_query',
        description: 'Execute a raw Pave query for advanced operations. Use with caution.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'object',
              description: 'Raw Pave query object (without grantKey)'
            }
          },
          required: ['query']
        }
      }
    ];

    // Add knowledge lookup if available
    if (this.knowledgeLookup) {
      tools.push({
        name: 'jobtread_knowledge_lookup',
        description: 'Query JobTread documentation and your company SOPs before performing operations. Returns your SOPs first, then official docs. Call this BEFORE create/update/import operations to ensure you follow your company processes.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'What to look up (e.g., "change order creation", "budget formulas", "task templates")'
            },
            category: {
              type: 'string',
              enum: ['estimating', 'scheduling', 'budgeting', 'invoicing', 'tasks', 'documents', 'general', 'company_policies', 'client_communication'],
              description: 'Optional category filter'
            }
          },
          required: ['query']
        }
      });

      // SOP Management Tools
      tools.push({
        name: 'sop_list',
        description: 'List all SOP (Standard Operating Procedure) documents linked to your organization. Returns titles, descriptions, and categories.',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: ['estimating', 'scheduling', 'budgeting', 'invoicing', 'tasks', 'documents', 'general', 'company_policies', 'client_communication'],
              description: 'Optional category filter'
            }
          }
        }
      });

      tools.push({
        name: 'sop_add',
        description: 'Add an external SOP document link (Google Docs, Notion, etc.) to your organization. The AI will use this document as context when helping with related tasks.',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Name/title of the SOP document'
            },
            document_url: {
              type: 'string',
              description: 'URL to the document (Google Docs, Notion, or public URL)'
            },
            description: {
              type: 'string',
              description: 'Brief description of what this SOP covers'
            },
            category: {
              type: 'string',
              enum: ['estimating', 'scheduling', 'budgeting', 'invoicing', 'tasks', 'documents', 'general', 'company_policies', 'client_communication'],
              description: 'Category for the SOP'
            }
          },
          required: ['title', 'document_url']
        }
      });

      tools.push({
        name: 'sop_remove',
        description: 'Remove an SOP document from your organization by ID.',
        inputSchema: {
          type: 'object',
          properties: {
            sop_id: {
              type: 'string',
              description: 'ID of the SOP to remove (get from sop_list)'
            }
          },
          required: ['sop_id']
        }
      });

      tools.push({
        name: 'sop_refresh',
        description: 'Force refresh the cached content of an SOP document (re-fetch from source URL).',
        inputSchema: {
          type: 'object',
          properties: {
            sop_id: {
              type: 'string',
              description: 'ID of the SOP to refresh'
            }
          },
          required: ['sop_id']
        }
      });
    }

    return tools;
  }

  /**
   * Handle tool call
   */
  async handleToolCall(name, args) {
    const startTime = Date.now();
    let success = true;
    let errorMessage = null;

    try {
      switch (name) {
        case 'jobtread_knowledge_lookup':
          if (!this.knowledgeLookup) {
            throw new Error('Knowledge lookup not available on your tier');
          }
          return await this.knowledgeLookup.lookup(args.query, args.category);

        // SOP Management
        case 'sop_list':
          return await this.listSops(args.category);

        case 'sop_add':
          return await this.addSop(args);

        case 'sop_remove':
          return await this.removeSop(args.sop_id);

        case 'sop_refresh':
          return await this.refreshSop(args.sop_id);

        case 'jobtread_search_jobs':
          return await this.searchJobs(args);

        case 'jobtread_get_job':
          return await this.getJob(args.jobId);

        case 'jobtread_list_tasks':
          return await this.listTasks(args);

        case 'jobtread_create_task':
          return await this.createTask(args);

        case 'jobtread_update_task':
          return await this.updateTask(args);

        case 'jobtread_get_budget':
          return await this.getBudget(args.jobId);

        case 'jobtread_search_contacts':
          return await this.searchContacts(args);

        case 'jobtread_create_contact':
          return await this.createContact(args);

        case 'jobtread_get_custom_fields':
          return await this.getCustomFields();

        case 'jobtread_raw_query':
          return await this.rawQuery(args.query);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      success = false;
      errorMessage = error.message;
      throw error;
    } finally {
      // Log usage
      const latency = Date.now() - startTime;
      await this.trackUsage(name, success, errorMessage, latency);
    }
  }

  /**
   * Search jobs
   */
  async searchJobs({ query, status, limit = 20 }) {
    const whereConditions = [];

    if (query) {
      whereConditions.push({
        or: [
          ['name', 'ilike', `%${query}%`],
          ['number', 'ilike', `%${query}%`]
        ]
      });
    }

    if (status) {
      whereConditions.push(['status', '=', status]);
    }

    const paveQuery = {
      organization: {
        $: { id: this.orgId },
        jobs: {
          $: {
            size: Math.min(limit, 100),
            where: whereConditions.length === 1 ? whereConditions[0] : { and: whereConditions },
            sortBy: [{ field: 'updatedAt', direction: 'desc' }]
          },
          nodes: {
            id: {},
            name: {},
            number: {},
            status: {},
            address: {
              city: {},
              state: {}
            },
            customer: {
              name: {}
            }
          }
        }
      }
    };

    // Remove where clause if empty
    if (whereConditions.length === 0) {
      delete paveQuery.organization.jobs.$.where;
    }

    const data = await this.jobtreadRequest(paveQuery);
    return {
      jobs: data.organization?.jobs?.nodes || [],
      count: (data.organization?.jobs?.nodes || []).length
    };
  }

  /**
   * Get job details
   */
  async getJob(jobId) {
    const paveQuery = {
      job: {
        $: { id: jobId },
        id: {},
        name: {},
        number: {},
        status: {},
        description: {},
        address: {
          street: {},
          city: {},
          state: {},
          zip: {}
        },
        customer: {
          id: {},
          name: {},
          email: {},
          phone: {}
        },
        budget: {
          totalCost: {},
          totalPrice: {},
          totalProfit: {}
        },
        customFieldValues: {
          nodes: {
            customField: {
              name: {}
            },
            value: {}
          }
        },
        createdAt: {},
        updatedAt: {}
      }
    };

    const data = await this.jobtreadRequest(paveQuery);
    return data.job || { error: 'Job not found' };
  }

  /**
   * List tasks
   */
  async listTasks({ jobId, status, assigneeEmail, limit = 50 }) {
    let paveQuery;

    if (jobId) {
      // Tasks for specific job
      paveQuery = {
        job: {
          $: { id: jobId },
          tasks: {
            $: {
              size: Math.min(limit, 200),
              sortBy: [{ field: 'startDate' }]
            },
            nodes: {
              id: {},
              name: {},
              description: {},
              status: {},
              startDate: {},
              endDate: {},
              assignees: {
                nodes: {
                  user: {
                    name: {},
                    email: {}
                  }
                }
              }
            }
          }
        }
      };
    } else {
      // Tasks across organization
      paveQuery = {
        organization: {
          $: { id: this.orgId },
          tasks: {
            $: {
              size: Math.min(limit, 200),
              sortBy: [{ field: 'startDate' }]
            },
            nodes: {
              id: {},
              name: {},
              status: {},
              startDate: {},
              endDate: {},
              job: {
                id: {},
                name: {},
                number: {}
              }
            }
          }
        }
      };
    }

    const data = await this.jobtreadRequest(paveQuery);

    if (jobId) {
      return { tasks: data.job?.tasks?.nodes || [] };
    }
    return { tasks: data.organization?.tasks?.nodes || [] };
  }

  /**
   * Create task
   */
  async createTask({ jobId, name, description, startDate, endDate, assigneeEmails }) {
    // Note: This requires mutation support in Pave
    // For now, return info about what would be created
    const taskInfo = {
      jobId,
      name,
      description,
      startDate,
      endDate,
      assigneeEmails,
      _note: 'Task creation via MCP requires mutation implementation'
    };

    return {
      success: false,
      message: 'Task creation is not yet fully implemented. Use JobTread UI for now.',
      taskInfo
    };
  }

  /**
   * Update task
   */
  async updateTask({ taskId, name, description, status, startDate, endDate }) {
    return {
      success: false,
      message: 'Task update is not yet fully implemented. Use JobTread UI for now.',
      taskId,
      updates: { name, description, status, startDate, endDate }
    };
  }

  /**
   * Get budget
   */
  async getBudget(jobId) {
    const paveQuery = {
      job: {
        $: { id: jobId },
        id: {},
        name: {},
        budget: {
          id: {},
          totalCost: {},
          totalPrice: {},
          totalProfit: {},
          costGroups: {
            nodes: {
              id: {},
              name: {},
              totalCost: {},
              totalPrice: {},
              lineItems: {
                nodes: {
                  id: {},
                  name: {},
                  quantity: {},
                  unitCost: {},
                  unitPrice: {},
                  totalCost: {},
                  totalPrice: {}
                }
              }
            }
          }
        }
      }
    };

    const data = await this.jobtreadRequest(paveQuery);
    return data.job?.budget || { error: 'Budget not found' };
  }

  /**
   * Search contacts
   */
  async searchContacts({ query, type, limit = 20 }) {
    const whereConditions = [];

    if (query) {
      whereConditions.push({
        or: [
          ['name', 'ilike', `%${query}%`],
          ['email', 'ilike', `%${query}%`]
        ]
      });
    }

    const paveQuery = {
      organization: {
        $: { id: this.orgId },
        contacts: {
          $: {
            size: Math.min(limit, 100),
            where: whereConditions.length > 0 ? whereConditions[0] : undefined,
            sortBy: [{ field: 'name' }]
          },
          nodes: {
            id: {},
            name: {},
            email: {},
            phone: {},
            type: {}
          }
        }
      }
    };

    if (whereConditions.length === 0) {
      delete paveQuery.organization.contacts.$.where;
    }

    const data = await this.jobtreadRequest(paveQuery);
    return {
      contacts: data.organization?.contacts?.nodes || [],
      count: (data.organization?.contacts?.nodes || []).length
    };
  }

  /**
   * Create contact
   */
  async createContact({ name, email, phone, type, address }) {
    return {
      success: false,
      message: 'Contact creation is not yet fully implemented. Use JobTread UI for now.',
      contactInfo: { name, email, phone, type, address }
    };
  }

  /**
   * Get custom fields
   */
  async getCustomFields() {
    const paveQuery = {
      organization: {
        $: { id: this.orgId },
        customFields: {
          $: {
            where: ['targetType', '=', 'job'],
            sortBy: [{ field: 'position' }]
          },
          nodes: {
            id: {},
            name: {},
            type: {},
            options: {},
            required: {}
          }
        }
      }
    };

    const data = await this.jobtreadRequest(paveQuery);
    return {
      fields: data.organization?.customFields?.nodes || []
    };
  }

  /**
   * Execute raw Pave query
   */
  async rawQuery(query) {
    const data = await this.jobtreadRequest(query);
    return { data };
  }

  // ==========================================
  // SOP Management Methods
  // ==========================================

  /**
   * List all SOPs for the organization
   */
  async listSops(category) {
    try {
      if (!this.env.AI_KNOWLEDGE_DB) {
        return { error: 'SOP database not configured' };
      }

      const params = [this.orgId];
      let sql = `
        SELECT id, title, description, document_url, category, is_active,
               cached_at, fetch_error, created_at, updated_at
        FROM user_sops
        WHERE org_id = ?
      `;

      if (category) {
        sql += ' AND category = ?';
        params.push(category);
      }

      sql += ' ORDER BY updated_at DESC';

      const result = await this.env.AI_KNOWLEDGE_DB.prepare(sql).bind(...params).all();
      const sops = result.results || [];

      return {
        count: sops.length,
        sops: sops.map(sop => ({
          id: sop.id,
          title: sop.title,
          description: sop.description,
          url: sop.document_url,
          category: sop.category,
          active: sop.is_active === 1,
          lastCached: sop.cached_at,
          error: sop.fetch_error,
          createdAt: sop.created_at
        }))
      };
    } catch (error) {
      console.error('List SOPs error:', error);
      return { error: error.message };
    }
  }

  /**
   * Add a new SOP document
   */
  async addSop({ title, document_url, description, category }) {
    try {
      if (!this.env.AI_KNOWLEDGE_DB) {
        return { error: 'SOP database not configured' };
      }

      // Validate URL format
      try {
        new URL(document_url);
      } catch {
        return { error: 'Invalid document URL format' };
      }

      // Generate ID
      const id = `sop_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      await this.env.AI_KNOWLEDGE_DB.prepare(`
        INSERT INTO user_sops (id, org_id, user_id, title, description, document_url, category, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `).bind(
        id,
        this.orgId,
        this.user.id,
        title,
        description || null,
        document_url,
        category || 'general'
      ).run();

      // Try to fetch and cache the document content immediately
      let fetchStatus = 'pending';
      if (this.knowledgeLookup) {
        try {
          const content = await this.knowledgeLookup.fetchExternalDocument(document_url);
          if (content) {
            await this.env.AI_KNOWLEDGE_DB.prepare(`
              UPDATE user_sops
              SET cached_content = ?, cached_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).bind(content, id).run();
            fetchStatus = 'cached';
          } else {
            await this.env.AI_KNOWLEDGE_DB.prepare(`
              UPDATE user_sops
              SET fetch_error = 'Could not fetch document - check URL and permissions'
              WHERE id = ?
            `).bind(id).run();
            fetchStatus = 'fetch_failed';
          }
        } catch (e) {
          fetchStatus = 'fetch_error';
        }
      }

      return {
        success: true,
        id: id,
        title: title,
        category: category || 'general',
        fetchStatus: fetchStatus,
        message: fetchStatus === 'cached'
          ? 'SOP added and document content cached successfully'
          : 'SOP added. Document will be fetched on first use.'
      };
    } catch (error) {
      console.error('Add SOP error:', error);
      return { error: error.message };
    }
  }

  /**
   * Remove an SOP document
   */
  async removeSop(sopId) {
    try {
      if (!this.env.AI_KNOWLEDGE_DB) {
        return { error: 'SOP database not configured' };
      }

      // Check SOP exists and belongs to this org
      const existing = await this.env.AI_KNOWLEDGE_DB.prepare(`
        SELECT id, title FROM user_sops WHERE id = ? AND org_id = ?
      `).bind(sopId, this.orgId).first();

      if (!existing) {
        return { error: 'SOP not found or access denied' };
      }

      await this.env.AI_KNOWLEDGE_DB.prepare(`
        DELETE FROM user_sops WHERE id = ? AND org_id = ?
      `).bind(sopId, this.orgId).run();

      return {
        success: true,
        message: `SOP "${existing.title}" has been removed`
      };
    } catch (error) {
      console.error('Remove SOP error:', error);
      return { error: error.message };
    }
  }

  /**
   * Refresh SOP document cache
   */
  async refreshSop(sopId) {
    try {
      if (!this.env.AI_KNOWLEDGE_DB) {
        return { error: 'SOP database not configured' };
      }

      // Get SOP details
      const sop = await this.env.AI_KNOWLEDGE_DB.prepare(`
        SELECT id, title, document_url FROM user_sops WHERE id = ? AND org_id = ?
      `).bind(sopId, this.orgId).first();

      if (!sop) {
        return { error: 'SOP not found or access denied' };
      }

      if (!this.knowledgeLookup) {
        return { error: 'Knowledge lookup not available' };
      }

      // Fetch fresh content
      const content = await this.knowledgeLookup.fetchExternalDocument(sop.document_url);

      if (content) {
        await this.env.AI_KNOWLEDGE_DB.prepare(`
          UPDATE user_sops
          SET cached_content = ?, cached_at = CURRENT_TIMESTAMP, fetch_error = NULL
          WHERE id = ?
        `).bind(content, sopId).run();

        return {
          success: true,
          title: sop.title,
          contentLength: content.length,
          message: `SOP "${sop.title}" refreshed successfully (${content.length} characters)`
        };
      } else {
        await this.env.AI_KNOWLEDGE_DB.prepare(`
          UPDATE user_sops
          SET fetch_error = 'Could not fetch document - check URL and permissions', last_fetch_attempt = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(sopId).run();

        return {
          success: false,
          title: sop.title,
          error: 'Could not fetch document. Check that the URL is accessible and the document is shared properly.'
        };
      }
    } catch (error) {
      console.error('Refresh SOP error:', error);
      return { error: error.message };
    }
  }

  /**
   * Make request to JobTread Pave API
   */
  async jobtreadRequest(paveQuery) {
    const body = {
      query: {
        $: { grantKey: this.grantKey },
        ...paveQuery
      }
    };

    const response = await fetch(JOBTREAD_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`JobTread API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.errors && data.errors.length > 0) {
      throw new Error(`JobTread error: ${data.errors[0].message}`);
    }

    return data;
  }

  /**
   * Track tool usage for analytics
   */
  async trackUsage(toolName, success, errorMessage, latencyMs) {
    try {
      await this.env.DB.prepare(`
        INSERT INTO mcp_tool_usage (license_id, user_id, tool_name, client_name, success, error_message, latency_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        this.license.id,
        this.user.id,
        toolName,
        this.clientName,
        success ? 1 : 0,
        errorMessage,
        latencyMs
      ).run();
    } catch (e) {
      // Don't fail if tracking fails
      console.error('Usage tracking failed:', e);
    }
  }
}
