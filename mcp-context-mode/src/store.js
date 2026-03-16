/**
 * store.js — FTS5 Knowledge Base for Cloudflare D1.
 *
 * Adapted from context-mode (github.com/mksglu/context-mode) for Cloudflare Workers.
 * Uses D1 (Cloudflare's edge SQLite) instead of better-sqlite3.
 * All operations are async (D1 is async).
 *
 * Features:
 * - Markdown chunking by headings (preserves code blocks)
 * - FTS5 BM25-ranked search with Porter stemming
 * - Fuzzy fallback via Levenshtein distance
 * - Plain text and JSON indexing
 */

import { byteLength } from './truncate.js';

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const MAX_CHUNK_BYTES = 4096;

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
  'her', 'was', 'one', 'our', 'out', 'has', 'his', 'how', 'its', 'may',
  'new', 'now', 'old', 'see', 'way', 'who', 'did', 'get', 'got', 'let',
  'say', 'she', 'too', 'use', 'will', 'with', 'this', 'that', 'from',
  'they', 'been', 'have', 'many', 'some', 'them', 'than', 'each', 'make',
  'like', 'just', 'over', 'such', 'take', 'into', 'year', 'your', 'good',
  'could', 'would', 'about', 'which', 'their', 'there', 'other', 'after',
  'should', 'through', 'also', 'more', 'most', 'only', 'very', 'when',
  'what', 'then', 'these', 'those', 'being', 'does', 'done', 'both',
  'same', 'still', 'while', 'where', 'here', 'were', 'much',
]);

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

/**
 * Sanitize a search query for FTS5.
 * @param {string} query
 * @param {'AND'|'OR'} mode
 * @returns {string}
 */
function sanitizeQuery(query, mode = 'AND') {
  const words = query
    .replace(/['"(){}[\]*:^~]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0 && !['AND', 'OR', 'NOT', 'NEAR'].includes(w.toUpperCase()));

  if (words.length === 0) return '""';
  return words.map(w => `"${w}"`).join(mode === 'OR' ? ' OR ' : ' ');
}

/**
 * Levenshtein distance between two strings.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    prev = curr;
  }
  return prev[b.length];
}

/**
 * Max edit distance based on word length.
 * @param {number} wordLength
 * @returns {number}
 */
function maxEditDistance(wordLength) {
  if (wordLength <= 4) return 1;
  if (wordLength <= 12) return 2;
  return 3;
}

// ─────────────────────────────────────────────────────────
// Chunking
// ─────────────────────────────────────────────────────────

/**
 * Split markdown content into chunks by headings.
 * Preserves code blocks as atomic units.
 * @param {string} text
 * @returns {Array<{title: string, content: string, hasCode: boolean}>}
 */
function chunkMarkdown(text) {
  const chunks = [];
  let currentTitle = 'Introduction';
  let currentLines = [];
  let inCodeBlock = false;

  for (const line of text.split('\n')) {
    // Track code blocks
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      currentLines.push(line);
      continue;
    }

    // Only split on headings outside code blocks
    if (!inCodeBlock && /^#{1,4}\s/.test(line)) {
      // Flush previous chunk
      if (currentLines.length > 0) {
        const content = currentLines.join('\n').trim();
        if (content) {
          const subChunks = splitOversizedChunk(currentTitle, content);
          chunks.push(...subChunks);
        }
      }
      currentTitle = line.replace(/^#+\s*/, '').trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  // Flush final chunk
  if (currentLines.length > 0) {
    const content = currentLines.join('\n').trim();
    if (content) {
      const subChunks = splitOversizedChunk(currentTitle, content);
      chunks.push(...subChunks);
    }
  }

  return chunks;
}

/**
 * Split a chunk if it exceeds MAX_CHUNK_BYTES.
 * @param {string} title
 * @param {string} content
 * @returns {Array<{title: string, content: string, hasCode: boolean}>}
 */
function splitOversizedChunk(title, content) {
  const hasCode = /```[\s\S]*?```/.test(content);

  if (byteLength(content) <= MAX_CHUNK_BYTES) {
    return [{ title, content, hasCode }];
  }

  // Split at paragraph boundaries
  const paragraphs = content.split(/\n\n+/);
  const chunks = [];
  let currentChunk = [];
  let currentBytes = 0;
  let partNum = 1;

  for (const para of paragraphs) {
    const paraBytes = byteLength(para) + 2; // +2 for \n\n
    if (currentBytes + paraBytes > MAX_CHUNK_BYTES && currentChunk.length > 0) {
      chunks.push({
        title: `${title} (part ${partNum})`,
        content: currentChunk.join('\n\n'),
        hasCode: /```[\s\S]*?```/.test(currentChunk.join('\n\n')),
      });
      partNum++;
      currentChunk = [];
      currentBytes = 0;
    }
    currentChunk.push(para);
    currentBytes += paraBytes;
  }

  if (currentChunk.length > 0) {
    chunks.push({
      title: partNum > 1 ? `${title} (part ${partNum})` : title,
      content: currentChunk.join('\n\n'),
      hasCode: /```[\s\S]*?```/.test(currentChunk.join('\n\n')),
    });
  }

  return chunks;
}

/**
 * Chunk plain text by line groups with overlap.
 * @param {string} content
 * @param {number} linesPerChunk
 * @returns {Array<{title: string, content: string}>}
 */
function chunkPlainText(content, linesPerChunk = 20) {
  const lines = content.split('\n');
  const chunks = [];
  const overlap = 2;

  for (let i = 0; i < lines.length; i += linesPerChunk - overlap) {
    const slice = lines.slice(i, i + linesPerChunk);
    if (slice.length === 0) break;
    chunks.push({
      title: `Lines ${i + 1}-${i + slice.length}`,
      content: slice.join('\n'),
    });
  }

  return chunks;
}

/**
 * Walk a JSON object tree and create chunks by key paths.
 * @param {*} value
 * @param {string[]} path
 * @param {Array<{title: string, content: string, hasCode: boolean}>} chunks
 * @param {number} maxChunkBytes
 */
function walkJSON(value, path, chunks, maxChunkBytes) {
  if (value === null || value === undefined) return;

  if (typeof value !== 'object') {
    const title = path.length > 0 ? path.join('.') : 'root';
    const content = String(value);
    if (content.trim()) {
      chunks.push({ title, content, hasCode: false });
    }
    return;
  }

  if (Array.isArray(value)) {
    // Batch array items by size
    let batch = [];
    let batchBytes = 0;
    let batchNum = 1;
    const title = path.length > 0 ? path.join('.') : 'root';

    for (let i = 0; i < value.length; i++) {
      const itemStr = JSON.stringify(value[i], null, 2);
      const itemBytes = byteLength(itemStr);

      if (batchBytes + itemBytes > maxChunkBytes && batch.length > 0) {
        chunks.push({
          title: `${title}[${batchNum}]`,
          content: batch.join('\n'),
          hasCode: false,
        });
        batch = [];
        batchBytes = 0;
        batchNum++;
      }
      batch.push(itemStr);
      batchBytes += itemBytes;
    }

    if (batch.length > 0) {
      chunks.push({
        title: batchNum > 1 ? `${title}[${batchNum}]` : title,
        content: batch.join('\n'),
        hasCode: false,
      });
    }
    return;
  }

  // Object: recurse by key
  for (const [key, val] of Object.entries(value)) {
    const valStr = JSON.stringify(val);
    if (valStr && byteLength(valStr) <= maxChunkBytes) {
      // Small enough to be a single chunk
      const title = [...path, key].join('.');
      chunks.push({ title, content: valStr, hasCode: false });
    } else {
      // Recurse
      walkJSON(val, [...path, key], chunks, maxChunkBytes);
    }
  }
}

// ─────────────────────────────────────────────────────────
// ContentStore (D1-based)
// ─────────────────────────────────────────────────────────

export class ContentStore {
  /** @type {D1Database} */
  #db;

  /**
   * @param {D1Database} db - Cloudflare D1 database binding
   */
  constructor(db) {
    this.#db = db;
  }

  /**
   * Initialize the FTS5 schema. Call once during Worker startup or migration.
   */
  async initSchema() {
    await this.#db.batch([
      this.#db.prepare(`
        CREATE TABLE IF NOT EXISTS ctx_sources (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          org_id TEXT NOT NULL,
          label TEXT NOT NULL,
          chunk_count INTEGER NOT NULL DEFAULT 0,
          code_chunk_count INTEGER NOT NULL DEFAULT 0,
          indexed_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `),
      this.#db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_ctx_sources_org ON ctx_sources(org_id)
      `),
      this.#db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_ctx_sources_label ON ctx_sources(org_id, label)
      `),
      this.#db.prepare(`
        CREATE VIRTUAL TABLE IF NOT EXISTS ctx_chunks USING fts5(
          title,
          content,
          source_id UNINDEXED,
          org_id UNINDEXED,
          content_type UNINDEXED,
          tokenize='porter unicode61'
        )
      `),
      this.#db.prepare(`
        CREATE TABLE IF NOT EXISTS ctx_vocabulary (
          org_id TEXT NOT NULL,
          word TEXT NOT NULL,
          PRIMARY KEY (org_id, word)
        )
      `),
    ]);
  }

  /**
   * Index markdown content into the knowledge base.
   * @param {string} orgId
   * @param {string} content
   * @param {string} label
   * @returns {Promise<{sourceId: number, label: string, totalChunks: number, codeChunks: number}>}
   */
  async index(orgId, content, label) {
    const chunks = chunkMarkdown(content);
    return this.#insertChunks(orgId, chunks, label, content);
  }

  /**
   * Index plain text (logs, build output, test results).
   * @param {string} orgId
   * @param {string} content
   * @param {string} label
   * @param {number} [linesPerChunk=20]
   */
  async indexPlainText(orgId, content, label, linesPerChunk = 20) {
    if (!content || content.trim().length === 0) {
      return this.#insertChunks(orgId, [], label, '');
    }
    const chunks = chunkPlainText(content, linesPerChunk);
    return this.#insertChunks(
      orgId,
      chunks.map(c => ({ ...c, hasCode: false })),
      label,
      content
    );
  }

  /**
   * Index JSON content by walking the object tree.
   * @param {string} orgId
   * @param {string} content
   * @param {string} label
   */
  async indexJSON(orgId, content, label) {
    if (!content || content.trim().length === 0) {
      return this.indexPlainText(orgId, '', label);
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return this.indexPlainText(orgId, content, label);
    }

    const chunks = [];
    walkJSON(parsed, [], chunks, MAX_CHUNK_BYTES);

    if (chunks.length === 0) {
      return this.indexPlainText(orgId, content, label);
    }

    return this.#insertChunks(orgId, chunks, label, content);
  }

  /**
   * Insert chunks into D1 with deduplication.
   * @param {string} orgId
   * @param {Array<{title: string, content: string, hasCode: boolean}>} chunks
   * @param {string} label
   * @param {string} text
   */
  async #insertChunks(orgId, chunks, label, text) {
    const codeChunks = chunks.filter(c => c.hasCode).length;

    // Dedup: delete previous source with same label for this org
    await this.#db.batch([
      this.#db.prepare(
        'DELETE FROM ctx_chunks WHERE source_id IN (SELECT id FROM ctx_sources WHERE org_id = ? AND label = ?)'
      ).bind(orgId, label),
      this.#db.prepare(
        'DELETE FROM ctx_sources WHERE org_id = ? AND label = ?'
      ).bind(orgId, label),
    ]);

    // Insert source
    const sourceResult = await this.#db.prepare(
      'INSERT INTO ctx_sources (org_id, label, chunk_count, code_chunk_count) VALUES (?, ?, ?, ?) RETURNING id'
    ).bind(orgId, label, chunks.length, codeChunks).first();

    const sourceId = sourceResult?.id;

    // Insert chunks in batch
    if (chunks.length > 0) {
      const stmts = chunks.map(chunk => {
        const ct = chunk.hasCode ? 'code' : 'prose';
        return this.#db.prepare(
          'INSERT INTO ctx_chunks (title, content, source_id, org_id, content_type) VALUES (?, ?, ?, ?, ?)'
        ).bind(chunk.title, chunk.content, sourceId, orgId, ct);
      });

      // D1 batch limit is ~100 statements, chunk if needed
      for (let i = 0; i < stmts.length; i += 50) {
        await this.#db.batch(stmts.slice(i, i + 50));
      }
    }

    // Extract and store vocabulary
    if (text) {
      await this.#extractAndStoreVocabulary(orgId, text);
    }

    return { sourceId, label, totalChunks: chunks.length, codeChunks };
  }

  /**
   * BM25-ranked FTS5 search.
   * @param {string} orgId
   * @param {string} query
   * @param {number} [limit=3]
   * @param {string} [source]
   * @param {'AND'|'OR'} [mode='AND']
   * @returns {Promise<Array<{title: string, content: string, source: string, rank: number, contentType: string, matchLayer: string}>>}
   */
  async search(orgId, query, limit = 3, source, mode = 'AND') {
    const sanitized = sanitizeQuery(query, mode);

    let sql = `
      SELECT
        ctx_chunks.title,
        ctx_chunks.content,
        ctx_chunks.content_type,
        ctx_sources.label,
        bm25(ctx_chunks, 2.0, 1.0) AS rank
      FROM ctx_chunks
      JOIN ctx_sources ON ctx_sources.id = ctx_chunks.source_id
      WHERE ctx_chunks MATCH ?1 AND ctx_chunks.org_id = ?2
    `;
    const params = [sanitized, orgId];

    if (source) {
      sql += ' AND ctx_sources.label LIKE ?3';
      params.push(`%${source}%`);
    }

    sql += ' ORDER BY rank LIMIT ?';
    params.push(limit);

    const { results } = await this.#db.prepare(sql).bind(...params).all();

    return (results || []).map(r => ({
      title: r.title,
      content: r.content,
      source: r.label,
      rank: r.rank,
      contentType: r.content_type,
      matchLayer: 'porter',
    }));
  }

  /**
   * Search with fallback layers: Porter AND -> Porter OR -> Fuzzy correction.
   * @param {string} orgId
   * @param {string} query
   * @param {number} [limit=3]
   * @param {string} [source]
   */
  async searchWithFallback(orgId, query, limit = 3, source) {
    // Layer 1a: Porter + AND
    const porterAnd = await this.search(orgId, query, limit, source, 'AND');
    if (porterAnd.length > 0) return porterAnd;

    // Layer 1b: Porter + OR
    const porterOr = await this.search(orgId, query, limit, source, 'OR');
    if (porterOr.length > 0) return porterOr;

    // Layer 2: Fuzzy correction
    const corrected = await this.fuzzyCorrect(orgId, query);
    if (corrected && corrected !== query) {
      const fuzzyResults = await this.search(orgId, corrected, limit, source, 'OR');
      return fuzzyResults.map(r => ({ ...r, matchLayer: 'fuzzy', correctedQuery: corrected }));
    }

    return [];
  }

  /**
   * Fuzzy correction using Levenshtein distance against vocabulary.
   * @param {string} orgId
   * @param {string} query
   * @returns {Promise<string|null>}
   */
  async fuzzyCorrect(orgId, query) {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
    if (words.length === 0) return null;

    const correctedWords = [];
    let anyCorrected = false;

    for (const word of words) {
      const maxDist = maxEditDistance(word.length);
      const { results } = await this.#db.prepare(
        'SELECT word FROM ctx_vocabulary WHERE org_id = ? AND length(word) BETWEEN ? AND ?'
      ).bind(orgId, word.length - maxDist, word.length + maxDist).all();

      let bestWord = word;
      let bestDist = maxDist + 1;

      for (const { word: candidate } of (results || [])) {
        if (candidate === word) { bestWord = word; bestDist = 0; break; }
        const dist = levenshtein(word, candidate);
        if (dist < bestDist) {
          bestDist = dist;
          bestWord = candidate;
        }
      }

      if (bestDist > 0 && bestDist <= maxDist) {
        anyCorrected = true;
      }
      correctedWords.push(bestWord);
    }

    return anyCorrected ? correctedWords.join(' ') : null;
  }

  /**
   * Extract distinctive terms from text and store in vocabulary.
   * @param {string} orgId
   * @param {string} text
   */
  async #extractAndStoreVocabulary(orgId, text) {
    const words = text
      .toLowerCase()
      .split(/[^a-z0-9_-]+/)
      .filter(w => w.length >= 3 && w.length <= 40 && !STOPWORDS.has(w));

    // Deduplicate
    const unique = [...new Set(words)].slice(0, 200);

    if (unique.length === 0) return;

    const stmts = unique.map(word =>
      this.#db.prepare('INSERT OR IGNORE INTO ctx_vocabulary (org_id, word) VALUES (?, ?)').bind(orgId, word)
    );

    for (let i = 0; i < stmts.length; i += 50) {
      await this.#db.batch(stmts.slice(i, i + 50));
    }
  }

  /**
   * List all indexed sources for an org.
   * @param {string} orgId
   */
  async listSources(orgId) {
    const { results } = await this.#db.prepare(
      'SELECT label, chunk_count as chunkCount, indexed_at FROM ctx_sources WHERE org_id = ? ORDER BY id DESC'
    ).bind(orgId).all();
    return results || [];
  }

  /**
   * Get aggregate stats for an org's knowledge base.
   * @param {string} orgId
   */
  async getStats(orgId) {
    const row = await this.#db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM ctx_sources WHERE org_id = ?) AS sources,
        (SELECT COUNT(*) FROM ctx_chunks WHERE org_id = ?) AS chunks,
        (SELECT COUNT(*) FROM ctx_chunks WHERE org_id = ? AND content_type = 'code') AS codeChunks,
        (SELECT COUNT(*) FROM ctx_vocabulary WHERE org_id = ?) AS vocabulary
    `).bind(orgId, orgId, orgId, orgId).first();

    return row || { sources: 0, chunks: 0, codeChunks: 0, vocabulary: 0 };
  }

  /**
   * Delete all indexed content for an org.
   * @param {string} orgId
   */
  async clearOrg(orgId) {
    await this.#db.batch([
      this.#db.prepare('DELETE FROM ctx_chunks WHERE org_id = ?').bind(orgId),
      this.#db.prepare('DELETE FROM ctx_sources WHERE org_id = ?').bind(orgId),
      this.#db.prepare('DELETE FROM ctx_vocabulary WHERE org_id = ?').bind(orgId),
    ]);
  }
}
