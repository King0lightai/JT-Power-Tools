/**
 * Knowledge Lookup Tool
 * Three-tier knowledge retrieval: Team -> Community -> Official (Gemini)
 */

export class KnowledgeLookup {
  constructor(env, orgId) {
    this.env = env;
    this.orgId = orgId;
    this.geminiApiKey = env.GEMINI_API_KEY;
  }

  /**
   * Perform knowledge lookup across all three tiers
   *
   * @param {string} query - What to look up
   * @param {string} category - Optional category filter
   * @returns {Object} - Combined results from all tiers
   */
  async lookup(query, category = null) {
    const results = {
      team: null,
      community: null,
      official: null,
      combined: ''
    };

    // Run all three tiers in parallel for speed
    const [teamDocs, communityDocs, officialDocs] = await Promise.all([
      this.queryTeamDocs(query, category),
      this.queryCommunityDocs(query, category),
      this.queryGemini(query)
    ]);

    results.team = teamDocs;
    results.community = communityDocs;
    results.official = officialDocs;

    // Combine with priority weighting
    results.combined = this.combineResults(results);

    return results;
  }

  /**
   * Tier 1: Query team-specific documents (private to org)
   */
  async queryTeamDocs(query, category) {
    try {
      // Check if AI_KNOWLEDGE_DB binding exists
      if (!this.env.AI_KNOWLEDGE_DB) {
        return [];
      }

      const params = [this.orgId, `%${query}%`, `%${query}%`, `%${query}%`];
      let sql = `
        SELECT id, title, content, category, tags, save_count
        FROM process_documents
        WHERE org_id = ?
          AND visibility IN ('team', 'private')
          AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)
      `;

      if (category) {
        sql += ' AND category = ?';
        params.push(category);
      }

      sql += ' ORDER BY save_count DESC LIMIT 5';

      const docs = await this.env.AI_KNOWLEDGE_DB.prepare(sql).bind(...params).all();
      return docs.results || [];
    } catch (error) {
      console.error('Team docs query error:', error);
      return [];
    }
  }

  /**
   * Tier 2: Query community documents (shared public)
   */
  async queryCommunityDocs(query, category) {
    try {
      if (!this.env.AI_KNOWLEDGE_DB) {
        return [];
      }

      const params = [`%${query}%`, `%${query}%`, `%${query}%`];
      let sql = `
        SELECT id, title, content, category, tags, save_count, author_name, author_org
        FROM process_documents
        WHERE visibility = 'public'
          AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)
      `;

      if (category) {
        sql += ' AND category = ?';
        params.push(category);
      }

      sql += ' ORDER BY save_count DESC LIMIT 5';

      const docs = await this.env.AI_KNOWLEDGE_DB.prepare(sql).bind(...params).all();
      return docs.results || [];
    } catch (error) {
      console.error('Community docs query error:', error);
      return [];
    }
  }

  /**
   * Tier 3: Query official documentation via Gemini
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

    // Team docs get highest priority header
    if (results.team && results.team.length > 0) {
      combined += "## Your Team's Processes\n\n";
      combined += "_These are your organization's internal SOPs and best practices._\n\n";

      for (const doc of results.team) {
        combined += `### ${doc.title}\n`;
        if (doc.category) {
          combined += `_Category: ${doc.category}_\n\n`;
        }
        combined += `${doc.content}\n\n`;
        combined += '---\n\n';
      }
    }

    // Community docs next
    if (results.community && results.community.length > 0) {
      combined += '## Community Best Practices\n\n';
      combined += '_Processes shared by other JobTread users._\n\n';

      for (const doc of results.community) {
        combined += `### ${doc.title}`;
        if (doc.save_count > 0) {
          combined += ` (${doc.save_count} saves)`;
        }
        combined += '\n';

        if (doc.author_name || doc.author_org) {
          combined += `_by ${doc.author_name || 'Anonymous'}`;
          if (doc.author_org) {
            combined += ` @ ${doc.author_org}`;
          }
          combined += '_\n\n';
        }

        // Truncate content if too long
        const content = doc.content.length > 1000
          ? doc.content.slice(0, 1000) + '...\n\n_(Content truncated)_'
          : doc.content;

        combined += `${content}\n\n`;
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
