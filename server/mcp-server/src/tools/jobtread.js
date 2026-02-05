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

      // List Customers
      {
        name: 'jobtread_list_customers',
        description: 'List customer accounts. Customers are the accounts you bill for work.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Optional search term to filter by name'
            },
            includeArchived: {
              type: 'boolean',
              description: 'Include archived customers (default: false)'
            },
            limit: {
              type: 'number',
              description: 'Maximum results (default 50, max 100)'
            }
          }
        }
      },

      // List Vendors
      {
        name: 'jobtread_list_vendors',
        description: 'List vendor accounts. Vendors are companies you pay for materials or services.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Optional search term to filter by name'
            },
            includeArchived: {
              type: 'boolean',
              description: 'Include archived vendors (default: false)'
            },
            limit: {
              type: 'number',
              description: 'Maximum results (default 50, max 100)'
            }
          }
        }
      },

      // Get Account Details
      {
        name: 'jobtread_get_account',
        description: 'Get detailed information about a customer or vendor account, including contacts, locations, and jobs.',
        inputSchema: {
          type: 'object',
          properties: {
            accountId: {
              type: 'string',
              description: 'The account ID'
            }
          },
          required: ['accountId']
        }
      },

      // Search Contacts (people on accounts)
      {
        name: 'jobtread_search_contacts',
        description: 'Search for contact people by name. Contacts are individuals associated with customer or vendor accounts. Note: Returns name and title only.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search term to match against contact name'
            },
            limit: {
              type: 'number',
              description: 'Maximum results (default 20)'
            }
          }
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

        // SOP Management (read-only)
        case 'sop_list':
          return await this.listSops(args.category);

        case 'jobtread_search_jobs':
          return await this.searchJobs(args);

        case 'jobtread_get_job':
          return await this.getJob(args.jobId);

        case 'jobtread_list_tasks':
          return await this.listTasks(args);

        case 'jobtread_get_budget':
          return await this.getBudget(args.jobId);

        case 'jobtread_list_customers':
          return await this.listCustomers(args);

        case 'jobtread_list_vendors':
          return await this.listVendors(args);

        case 'jobtread_get_account':
          return await this.getAccount(args.accountId);

        case 'jobtread_search_contacts':
          return await this.searchContacts(args);

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
   * List customers (accounts with type=customer)
   */
  async listCustomers({ query, includeArchived = false, limit = 50 }) {
    const whereConditions = [['type', '=', 'customer']];

    if (query) {
      whereConditions.push(['name', 'contains', query]);
    }

    if (!includeArchived) {
      whereConditions.push(['archivedAt', 'null']);
    }

    const paveQuery = {
      organization: {
        $: { id: this.orgId },
        accounts: {
          $: {
            size: Math.min(limit, 100),
            where: whereConditions.length === 1 ? whereConditions[0] : { and: whereConditions },
            sortBy: [{ field: 'name' }]
          },
          nextPage: {},
          nodes: {
            id: {},
            name: {},
            type: {},
            isTaxable: {},
            createdAt: {},
            archivedAt: {},
            contacts: {
              $: { size: 5 },
              nodes: {
                id: {},
                name: {},
                title: {}
              }
            },
            jobs: {
              $: { size: 5 },
              nodes: {
                id: {},
                name: {},
                number: {}
              }
            }
          }
        }
      }
    };

    const data = await this.jobtreadRequest(paveQuery);
    return {
      customers: data.organization?.accounts?.nodes || [],
      count: (data.organization?.accounts?.nodes || []).length,
      nextPage: data.organization?.accounts?.nextPage
    };
  }

  /**
   * List vendors (accounts with type=vendor)
   */
  async listVendors({ query, includeArchived = false, limit = 50 }) {
    const whereConditions = [['type', '=', 'vendor']];

    if (query) {
      whereConditions.push(['name', 'contains', query]);
    }

    if (!includeArchived) {
      whereConditions.push(['archivedAt', 'null']);
    }

    const paveQuery = {
      organization: {
        $: { id: this.orgId },
        accounts: {
          $: {
            size: Math.min(limit, 100),
            where: whereConditions.length === 1 ? whereConditions[0] : { and: whereConditions },
            sortBy: [{ field: 'name' }]
          },
          nextPage: {},
          nodes: {
            id: {},
            name: {},
            type: {},
            createdAt: {},
            archivedAt: {},
            contacts: {
              $: { size: 5 },
              nodes: {
                id: {},
                name: {},
                title: {}
              }
            }
          }
        }
      }
    };

    const data = await this.jobtreadRequest(paveQuery);
    return {
      vendors: data.organization?.accounts?.nodes || [],
      count: (data.organization?.accounts?.nodes || []).length,
      nextPage: data.organization?.accounts?.nextPage
    };
  }

  /**
   * Get account details (customer or vendor)
   */
  async getAccount(accountId) {
    const paveQuery = {
      account: {
        $: { id: accountId },
        id: {},
        name: {},
        type: {},
        isTaxable: {},
        createdAt: {},
        archivedAt: {},
        contacts: {
          $: { size: 20 },
          nodes: {
            id: {},
            name: {},
            title: {}
          }
        },
        locations: {
          $: { size: 20 },
          nodes: {
            id: {},
            name: {},
            address: {}
          }
        },
        jobs: {
          $: { size: 20 },
          nodes: {
            id: {},
            name: {},
            number: {},
            status: {},
            closedOn: {}
          }
        },
        customFieldValues: {
          nodes: {
            id: {},
            value: {},
            customField: {
              id: {},
              name: {},
              type: {}
            }
          }
        }
      }
    };

    const data = await this.jobtreadRequest(paveQuery);
    return data.account || { error: 'Account not found' };
  }

  /**
   * Search contacts (people on accounts)
   * Note: Contacts only have id, name, title - no email/phone per API schema
   */
  async searchContacts({ query, limit = 20 }) {
    const paveQuery = {
      organization: {
        $: { id: this.orgId },
        contacts: {
          $: {
            size: Math.min(limit, 100),
            where: query ? ['name', 'contains', query] : undefined,
            sortBy: [{ field: 'name' }]
          },
          nodes: {
            id: {},
            name: {},
            title: {},
            createdAt: {}
          }
        }
      }
    };

    if (!query) {
      delete paveQuery.organization.contacts.$.where;
    }

    const data = await this.jobtreadRequest(paveQuery);
    return {
      contacts: data.organization?.contacts?.nodes || [],
      count: (data.organization?.contacts?.nodes || []).length
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
  // SOP Management Methods (Read-Only)
  // ==========================================

  /**
   * List all SOPs for the organization (read-only)
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
