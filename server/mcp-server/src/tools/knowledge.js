/**
 * Knowledge Lookup Tool
 * Two-tier knowledge retrieval: User SOPs -> Official (Gemini)
 *
 * Priority order:
 * 1. User SOPs - External documents (Google Docs, Notion) the user has linked
 * 2. Official - Gemini-powered JobTread documentation
 */

export class KnowledgeLookup {
  constructor(env, orgId) {
    this.env = env;
    this.orgId = orgId;
    this.geminiApiKey = env.GEMINI_API_KEY;
  }

  /**
   * Perform knowledge lookup across both tiers
   *
   * @param {string} query - What to look up
   * @param {string} category - Optional category filter
   * @returns {Object} - Combined results from all tiers
   */
  async lookup(query, category = null) {
    const results = {
      userSops: null,
      official: null,
      combined: ''
    };

    // Run both tiers in parallel for speed
    const [userSops, officialDocs] = await Promise.all([
      this.queryUserSops(query, category),
      this.queryGemini(query)
    ]);

    results.userSops = userSops;
    results.official = officialDocs;

    // Combine with priority weighting
    results.combined = this.combineResults(results);

    return results;
  }

  /**
   * Tier 1: Query user's external SOP documents (highest priority)
   * These are external documents (Google Docs, Notion, etc.) the user has linked
   */
  async queryUserSops(query, category) {
    try {
      if (!this.env.AI_KNOWLEDGE_DB) {
        return [];
      }

      // Get active SOPs for this org
      const params = [this.orgId];
      let sql = `
        SELECT id, title, description, document_url, cached_content, cached_at,
               cache_ttl_hours, category, tags, fetch_error
        FROM user_sops
        WHERE org_id = ?
          AND is_active = 1
      `;

      if (category) {
        sql += ' AND category = ?';
        params.push(category);
      }

      sql += ' ORDER BY updated_at DESC LIMIT 10';

      const sopsResult = await this.env.AI_KNOWLEDGE_DB.prepare(sql).bind(...params).all();
      const sops = sopsResult.results || [];

      if (sops.length === 0) {
        return [];
      }

      // Process SOPs - fetch content if needed
      const processedSops = await Promise.all(
        sops.map(sop => this.processSop(sop, query))
      );

      // Filter to only SOPs that are relevant to the query
      return processedSops.filter(sop => sop && sop.content);
    } catch (error) {
      console.error('User SOPs query error:', error);
      return [];
    }
  }

  /**
   * Process a single SOP - check cache, fetch if needed, filter by relevance
   */
  async processSop(sop, query) {
    try {
      let content = sop.cached_content;
      const cacheAge = sop.cached_at
        ? (Date.now() - new Date(sop.cached_at).getTime()) / (1000 * 60 * 60)
        : Infinity;
      const cacheTtl = sop.cache_ttl_hours || 24;

      // Fetch fresh content if cache is stale or empty
      if (!content || cacheAge > cacheTtl) {
        content = await this.fetchExternalDocument(sop.document_url);

        if (content) {
          // Update cache in database
          await this.env.AI_KNOWLEDGE_DB.prepare(`
            UPDATE user_sops
            SET cached_content = ?, cached_at = CURRENT_TIMESTAMP, fetch_error = NULL
            WHERE id = ?
          `).bind(content, sop.id).run();
        } else if (!sop.cached_content) {
          // No cached content and fetch failed
          return null;
        }
        // If fetch failed but we have cached content, use that
      }

      // Check if content is relevant to query (simple keyword matching)
      const queryLower = query.toLowerCase();
      const contentLower = (content || '').toLowerCase();
      const titleLower = (sop.title || '').toLowerCase();
      const descLower = (sop.description || '').toLowerCase();

      const isRelevant = queryLower.split(/\s+/).some(word =>
        word.length > 2 && (
          contentLower.includes(word) ||
          titleLower.includes(word) ||
          descLower.includes(word)
        )
      );

      if (!isRelevant) {
        return null;
      }

      return {
        id: sop.id,
        title: sop.title,
        description: sop.description,
        content: content,
        category: sop.category,
        source_url: sop.document_url
      };
    } catch (error) {
      console.error('SOP processing error:', error);
      return null;
    }
  }

  /**
   * Fetch content from an external document URL
   * Supports Google Docs (export), Notion (via share link), and plain text URLs
   */
  async fetchExternalDocument(url) {
    try {
      let fetchUrl = url;

      // Convert Google Docs URL to export format
      if (url.includes('docs.google.com/document')) {
        // Extract document ID
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match) {
          const docId = match[1];
          fetchUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
        }
      }

      // Fetch with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(fetchUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'JobTread-Tools-Pro/1.0 (SOP-Fetcher)'
        }
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.error(`SOP fetch failed: ${response.status} for ${url}`);
        return null;
      }

      const contentType = response.headers.get('content-type') || '';
      let content = await response.text();

      // Basic HTML stripping if needed
      if (contentType.includes('html')) {
        content = this.stripHtml(content);
      }

      // Limit content size (max 50KB)
      if (content.length > 50000) {
        content = content.slice(0, 50000) + '\n\n[Content truncated - document too large]';
      }

      return content;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('SOP fetch timeout:', url);
      } else {
        console.error('SOP fetch error:', error);
      }
      return null;
    }
  }

  /**
   * Strip HTML tags for basic text extraction
   */
  stripHtml(html) {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Tier 2: Query official documentation via Gemini
   */
  async queryGemini(query) {
    try {
      // Check cache first
      const cacheKey = `gemini:${query.toLowerCase().replace(/\s+/g, '_').slice(0, 100)}`;

      if (this.env.CACHE) {
        const cached = await this.env.CACHE.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }

      // Skip if no API key
      if (!this.geminiApiKey) {
        return 'Official documentation lookup not available (Gemini API not configured)';
      }

      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.geminiApiKey
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `You are a JobTread construction management software expert.

Answer this question about JobTread: "${query}"

Provide:
1. The correct way to do this in JobTread
2. Required fields and parameters
3. Common mistakes to avoid
4. Any relevant API/Pave query syntax if applicable

Be specific and technical. Reference JobTread's actual features and terminology.
Keep your response concise but complete.`
              }]
            }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1024
            }
          })
        }
      );

      if (!response.ok) {
        console.error('Gemini API error:', response.status);
        return 'Official documentation lookup temporarily unavailable';
      }

      const data = await response.json();
      const result = data.candidates?.[0]?.content?.parts?.[0]?.text || null;

      // Cache for 24 hours
      if (result && this.env.CACHE) {
        await this.env.CACHE.put(cacheKey, JSON.stringify(result), {
          expirationTtl: 86400
        });
      }

      return result;
    } catch (error) {
      console.error('Gemini query error:', error);
      return 'Official documentation lookup failed';
    }
  }

  /**
   * Combine results from all tiers with priority formatting
   */
  combineResults(results) {
    let combined = '';

    // User SOPs get HIGHEST priority - these are the user's own processes
    if (results.userSops && results.userSops.length > 0) {
      combined += "## Your Company's SOPs\n\n";
      combined += "_These are your organization's standard operating procedures. Follow these first._\n\n";

      for (const sop of results.userSops) {
        combined += `### ${sop.title}\n`;
        if (sop.description) {
          combined += `_${sop.description}_\n\n`;
        }
        if (sop.category) {
          combined += `**Category:** ${sop.category}\n\n`;
        }

        // Include content (truncate if very long)
        const content = sop.content.length > 3000
          ? sop.content.slice(0, 3000) + '\n\n_(SOP content truncated for brevity)_'
          : sop.content;

        combined += `${content}\n\n`;
        combined += `_Source: [${sop.title}](${sop.source_url})_\n\n`;
        combined += '---\n\n';
      }
    }

    // Official docs as foundation
    if (results.official && typeof results.official === 'string' && results.official.length > 0) {
      combined += '## Official JobTread Documentation\n\n';
      combined += '_Information from official JobTread resources._\n\n';
      combined += results.official;
      combined += '\n\n';
    }

    // If nothing found
    if (!combined) {
      combined = `No specific documentation found for "${results.query || 'your query'}". `;
      combined += 'Try rephrasing your question or checking JobTread\'s help desk directly.';
    }

    return combined;
  }
}
