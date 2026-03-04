# PDF Parsing MCP Tool — Feature Specification

**Version:** 1.0 Draft
**Tier:** Power User
**Status:** Planning
**Dependencies:** MCP Server (Cloudflare Worker), JobTread Pave API (file URLs)

---

## Overview

Add a `parse_pdf` tool to the JT Power Tools MCP server that extracts text content from PDF files stored in JobTread. This enables AI assistants to read bid documents, proposals, contracts, plans specs, and other PDFs attached to jobs — then compare them against budgets, scopes, and other project data already accessible through existing MCP tools.

---

## Problem Statement

1. **Bids are PDFs** — Subcontractor bids, vendor proposals, and scope documents arrive as PDF files uploaded to JobTread jobs
2. **Manual comparison** — PMs currently read each bid PDF manually and compare line items against the budget by hand
3. **Scope alignment is tedious** — Checking that a bid covers the correct scope of work requires cross-referencing the bid PDF with budget line items, often across multiple cost codes
4. **AI can't read files today** — The existing `get_job_files` tool returns file metadata (name, URL, tags) but the AI cannot access or read the actual PDF content
5. **Multi-bid comparison** — When multiple subs bid the same scope, comparing them side-by-side is entirely manual

---

## Solution

A new MCP tool (`parse_pdf`) that:
- Accepts a JobTread file ID (from `get_job_files` results)
- Fetches the file's CDN URL via the Pave API
- Downloads the PDF binary content
- Extracts text using a PDF parsing library (pdf-parse or pdf.js)
- Returns structured text content to the AI assistant

This enables workflows like:
- "Pull all the bid PDFs for the Smith Residence job and compare them to the budget"
- "Check if the electrical bid covers all the scope items in our budget"
- "Summarize the key terms from the signed contract"

---

## Tool Definition

### `parse_pdf`

**Description:** Extracts text content from a PDF file stored in JobTread. Use this after `get_job_files` to read the actual content of bid documents, proposals, contracts, or any PDF attachment.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "fileId": {
      "type": "string",
      "description": "The JobTread file ID (from get_job_files or get_file results)"
    },
    "maxPages": {
      "type": "number",
      "description": "Maximum number of pages to parse (default: 50, max: 200). Use to limit response size for large documents."
    }
  },
  "required": ["fileId"]
}
```

**Output:**
```json
{
  "fileName": "Drawings.BidSet.Favero.pdf",
  "fileSize": 4905357,
  "pageCount": 12,
  "pagesReturned": 12,
  "text": "Full extracted text content...",
  "pages": [
    { "page": 1, "text": "Page 1 content..." },
    { "page": 2, "text": "Page 2 content..." }
  ]
}
```

**Error Cases:**
- File not found → `"File not found with ID: {fileId}"`
- Not a PDF → `"File is not a PDF: {fileName}"`
- PDF too large → `"PDF exceeds maximum size of 25MB"`
- Parse failure → `"Failed to extract text from PDF. The file may be image-based (scanned). Try OCR tools instead."`

---

## Implementation

### MCP Server (Cloudflare Worker)

#### Dependencies
- `pdf-parse` (npm) — lightweight PDF text extraction, works in Workers runtime
- Alternative: `unpdf` — built for edge runtimes, uses pdf.js under the hood

#### Tool Handler

```javascript
async function handleParsePdf(params, grantKey, orgId) {
  const { fileId, maxPages = 50 } = params;

  // 1. Fetch file metadata from JobTread
  const fileQuery = {
    '$': { grantKey },
    file: {
      '$': { id: fileId },
      id: {},
      name: {},
      url: {},
      size: {}
    }
  };

  const fileResult = await queryPave(fileQuery);
  const file = fileResult.file;

  if (!file || !file.id) {
    throw new Error(`File not found with ID: ${fileId}`);
  }

  // 2. Validate it's a PDF
  const isPdf = file.name?.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    throw new Error(`File is not a PDF: ${file.name}`);
  }

  // 3. Check file size (25MB limit for Worker memory)
  const MAX_SIZE = 25 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error(`PDF exceeds maximum size of 25MB (file is ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
  }

  // 4. Download PDF binary
  const pdfResponse = await fetch(file.url);
  if (!pdfResponse.ok) {
    throw new Error(`Failed to download PDF: HTTP ${pdfResponse.status}`);
  }
  const pdfBuffer = await pdfResponse.arrayBuffer();

  // 5. Parse PDF text
  const parsed = await parsePdf(pdfBuffer, maxPages);

  return {
    fileName: file.name,
    fileSize: file.size,
    pageCount: parsed.totalPages,
    pagesReturned: parsed.pages.length,
    text: parsed.text,
    pages: parsed.pages
  };
}
```

#### PDF Parsing Options

**Option A: `unpdf` (Recommended for Cloudflare Workers)**
- Built for edge runtimes
- Uses Mozilla's pdf.js under the hood
- No Node.js dependencies
- Install: `npm install unpdf`

```javascript
import { extractText } from 'unpdf';

async function parsePdf(buffer, maxPages) {
  const { totalPages, text, pages } = await extractText(buffer, {
    mergePages: false,
    maxPages
  });

  return {
    totalPages,
    text: pages.slice(0, maxPages).join('\n\n--- Page Break ---\n\n'),
    pages: pages.slice(0, maxPages).map((text, i) => ({
      page: i + 1,
      text
    }))
  };
}
```

**Option B: `pdf-parse`**
- More mature, widely used
- May need polyfills for Worker environment
- Install: `npm install pdf-parse`

---

## Workflows Enabled

### Workflow: Bid Comparison Against Budget
```
Step 1: get_job_files → list all files for the job, filter by "Bid" tag
Step 2: parse_pdf (for each bid) → extract bid content
Step 3: get_job_budget → get budget line items with costs
Step 4: AI compares bid line items against budget scope and pricing
Step 5: AI produces comparison summary with scope gaps and price deltas
```

### Workflow: Scope Alignment Check
```
Step 1: get_job_files → find the scope document / spec PDF
Step 2: parse_pdf → extract full scope text
Step 3: get_job_budget → get all cost items
Step 4: AI cross-references scope items against budget line items
Step 5: AI flags scope items not covered in budget (and vice versa)
```

### Workflow: Contract Review
```
Step 1: get_job_files → find signed contract PDF
Step 2: parse_pdf → extract contract text
Step 3: AI summarizes key terms: payment schedule, change order process,
        warranty, start/completion dates, allowances, exclusions
```

### Workflow: Multi-Sub Bid Leveling
```
Step 1: get_job_files → find all electrical bids (filter by tag or name)
Step 2: parse_pdf (for each) → extract bid amounts and scope
Step 3: get_job_budget → get budgeted electrical line items
Step 4: AI creates bid leveling matrix:
        - Sub name, total price, included scope, exclusions, lead time
Step 5: AI recommends best value option with reasoning
```

---

## Limitations & Future Enhancements

### Current Limitations
- **Scanned/image PDFs** — Text extraction won't work on scanned documents. Would need OCR (Tesseract or cloud OCR service) for those.
- **Tables** — PDF text extraction often loses table structure. Complex bid tables may come through as jumbled text.
- **Drawings** — Architectural/engineering drawings are visual content, not extractable as text.
- **25MB size limit** — Cloudflare Worker memory constraints limit file size.

### Future Enhancements
1. **OCR support** — Integrate Tesseract.js or a cloud OCR API for scanned documents
2. **Table extraction** — Use specialized table extraction (Tabula-style) for structured bid data
3. **Document type detection** — Auto-classify PDFs (bid, contract, permit, drawing) based on content
4. **Batch parsing** — Parse multiple PDFs in one call for efficiency
5. **Caching** — Cache parsed text in D1 to avoid re-parsing the same file

---

## Security Considerations

- **Read-only** — This tool only reads files, never modifies or uploads
- **Auth required** — File access is gated by the user's grant key (same as all other tools)
- **Size limits** — Enforced to prevent Worker memory exhaustion
- **No external sharing** — PDF content is returned only to the authenticated AI session
- **File type validation** — Only `.pdf` files are processed; other types are rejected
