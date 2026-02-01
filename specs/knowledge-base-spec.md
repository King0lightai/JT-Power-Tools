# Company Knowledge Base — Feature Specification

**Version:** 2.0 Draft
**Tier:** Power User
**Status:** Planning
**Dependencies:** User Accounts (Foundation), Cloudflare D1, MCP Server (for AI search)

---

## Overview

The Company Knowledge Base is a centralized repository for SOPs, procedures, tips, and company-wide knowledge — the stuff that doesn't belong on any single job. Unlike JobTread's job-specific messages and custom fields, the Knowledge Base stores information that applies across jobs or to the company as a whole.

**This is NOT competing with JobTread.** JobTread handles job notes, customer notes, and location notes. The Knowledge Base handles everything else — the institutional knowledge that gets lost in Slack, email, or people's heads.

---

## Problem Statement

1. **Knowledge loss** — Experienced employees have tips and tricks that new hires can't access
2. **Scattered SOPs** — Procedures live in Google Docs, PDFs, emails, or nowhere
3. **Repeated questions** — "How do we handle change orders?" gets asked every month
4. **No single source of truth** — Everyone has their own version of "how we do things"
5. **Field access** — Workers on site can't easily look up procedures

---

## Solution

A company-wide knowledge base that:
- Lives inside JobTread via the Power Tools extension
- Accessible on any device (desktop, mobile via Edge/Firefox)
- Searchable with AI-powered natural language queries
- Organized by categories (Safety, Procedures, Vendor Notes, Templates, etc.)
- Updated in real-time — change once, everyone sees it

---

## Differentiation from JobTread

| Type of Information | Where It Lives |
|---------------------|----------------|
| "Gate code for Smith Residence is 4421" | JobTread job messages |
| "Client prefers morning deliveries" | JobTread customer record |
| "Always get signed change orders before starting work" | **Knowledge Base** |
| "Mike's Plumbing runs late but does great work" | **Knowledge Base** |
| "Standard scope language for bathroom remodels" | **Knowledge Base** |
| "Lockout/tagout procedure for electrical work" | **Knowledge Base** |

---

## User Stories

### Finding Information
- As a field worker, I want to quickly look up a procedure from my phone
- As a new employee, I want to find "how we do things" without asking everyone
- As anyone, I want to ask a question in plain English and get an answer

### Contributing Knowledge
- As an experienced employee, I want to document my tips for others
- As a manager, I want to maintain official SOPs that everyone follows
- As anyone, I want to share vendor notes that help the whole team

### Staying Current
- As a team member, I want to know when procedures change
- As a manager, I want to update a procedure once and have everyone see it

---

## Feature Requirements

### P0 — Must Have (MVP)

| Feature | Description |
|---------|-------------|
| Knowledge articles | Rich text content with categories |
| Categories | Pre-built + custom: Safety, Procedures, Vendor Notes, Templates, Tips |
| Full-text search | Find articles by keyword |
| Mobile access | Works on Edge/Firefox mobile with extension |
| Attribution | "Last updated by Mike, Jan 15" |
| Sync | Same content everywhere via User Accounts |

### P1 — Should Have

| Feature | Description |
|---------|-------------|
| AI-powered search | Natural language queries via MCP server |
| Video embeds | Link to YouTube, Loom, Vimeo training videos |
| Offline mode | Cache articles for jobsites with poor connectivity |
| Pinned articles | Important/frequently-used articles at top |
| Recently viewed | Quick access to articles you've read |

### P2 — Nice to Have

| Feature | Description |
|---------|-------------|
| QR codes | Generate QR → scan at jobsite → see procedure |
| Decision trees | Guided troubleshooting (if this, then that) |
| Version history | See what changed, when, by whom |
| Read receipts | Know who's seen critical safety updates |
| Comments | Discuss/ask questions on articles |
| Templates | Insert template text into JobTread fields |

---

## Content Categories

### Pre-Built Categories

| Category | Description | Examples |
|----------|-------------|----------|
| **Safety** | Safety procedures, OSHA requirements | Lockout/tagout, fall protection, PPE |
| **Procedures** | How we do things | Change order process, punch list procedure |
| **Vendor Notes** | Info about subs, suppliers, vendors | "Mike's Plumbing runs late but does great work" |
| **Templates** | Reusable text snippets | Standard scope language, email templates |
| **Tips & Tricks** | Best practices, shortcuts | "Here's how to handle difficult clients" |
| **Onboarding** | New employee resources | First week checklist, tool list, contacts |

### Custom Categories
- Admins can create custom categories
- Examples: "Electrical", "Plumbing", "Customer Service"

---

## Technical Architecture

### Data Model

```sql
-- Cloudflare D1 Tables

CREATE TABLE kb_articles (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,           -- Rich text / markdown
  author_user_id TEXT NOT NULL,
  author_display_name TEXT,        -- Cached for display
  is_pinned INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (author_user_id) REFERENCES users(id),
  FOREIGN KEY (category_id) REFERENCES kb_categories(id)
);

CREATE TABLE kb_categories (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,                       -- Emoji or icon name
  sort_order INTEGER,
  is_system INTEGER DEFAULT 0,     -- Pre-built vs custom
  created_at INTEGER
);

CREATE TABLE kb_article_versions (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  content TEXT NOT NULL,
  editor_user_id TEXT NOT NULL,
  editor_display_name TEXT,
  created_at INTEGER,
  FOREIGN KEY (article_id) REFERENCES kb_articles(id)
);

-- For read receipts (P2)
CREATE TABLE kb_article_reads (
  article_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  read_at INTEGER,
  PRIMARY KEY (article_id, user_id)
);

-- Indexes
CREATE INDEX idx_kb_articles_org ON kb_articles(org_id);
CREATE INDEX idx_kb_articles_category ON kb_articles(category_id);
CREATE INDEX idx_kb_articles_search ON kb_articles(org_id, title);
```

### API Endpoints

All endpoints require `Authorization: Bearer <access_token>` header.

```
Knowledge Base:
GET    /kb/articles              — List all articles (paginated)
GET    /kb/articles/:id          — Get single article
POST   /kb/articles              — Create article
PUT    /kb/articles/:id          — Update article
DELETE /kb/articles/:id          — Delete article
GET    /kb/categories            — List categories
POST   /kb/categories            — Create custom category
GET    /kb/search?q=             — Full-text search
POST   /kb/ai-search             — AI-powered natural language search (via MCP)

Offline Support:
GET    /kb/sync                  — Get all articles for offline cache
GET    /kb/sync/since/:timestamp — Get articles changed since timestamp
```

### MCP Server Integration

Leverage existing MCP infrastructure for AI-powered search:

```javascript
// User asks: "How do we handle change orders?"

// MCP Server receives query
{
  tool: "knowledge_base_search",
  query: "how do we handle change orders"
}

// MCP queries Knowledge Base
// Returns relevant articles with highlighted excerpts

// Response to user
{
  answer: "Based on your company's procedures...",
  articles: [
    { title: "Change Order Process", excerpt: "..." },
    { title: "Customer Communication", excerpt: "..." }
  ]
}
```

This extends the existing `jobtread_knowledge_lookup` tool to include company-specific knowledge.

---

## UI/UX Design

### Main Panel

```
┌─────────────────────────────────────────────────────┐
│ KNOWLEDGE BASE                              [×]     │
├─────────────────────────────────────────────────────┤
│ [🔍 Search or ask a question...              ]      │
├─────────────────────────────────────────────────────┤
│ 📌 PINNED                                           │
│ ├─ Change Order Process                             │
│ └─ Safety Checklist                                 │
├─────────────────────────────────────────────────────┤
│ 🛡️ SAFETY                                      [3] │
│ 🔧 PROCEDURES                                  [8] │
│ 👷 VENDOR NOTES                                [12]│
│ 📝 TEMPLATES                                   [5] │
│ 💡 TIPS & TRICKS                               [7] │
│ 📚 ONBOARDING                                  [4] │
├─────────────────────────────────────────────────────┤
│ [+ New Article]                                     │
└─────────────────────────────────────────────────────┘
```

### Article View

```
┌─────────────────────────────────────────────────────┐
│ ← Back                                    [Edit] 🔗 │
├─────────────────────────────────────────────────────┤
│ CHANGE ORDER PROCESS                                │
│ Category: Procedures                                │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Before starting any work outside the original       │
│ scope, you MUST have a signed change order.         │
│                                                     │
│ ## Steps                                            │
│ 1. Document the requested change                    │
│ 2. Get pricing approved by PM                       │
│ 3. Send change order to customer                    │
│ 4. Wait for signature before starting               │
│                                                     │
│ ## Video Training                                   │
│ [▶️ Watch: Change Order Walkthrough]                │
│                                                     │
├─────────────────────────────────────────────────────┤
│ Last updated by Sarah, Jan 15, 2025                 │
│ Created by Mike, Dec 3, 2024                        │
└─────────────────────────────────────────────────────┘
```

### AI Search

```
┌─────────────────────────────────────────────────────┐
│ [🔍 how do I handle a difficult customer?    ] [Go]│
├─────────────────────────────────────────────────────┤
│ 🤖 Based on your company's knowledge base:          │
│                                                     │
│ "When dealing with difficult customers, follow      │
│ the de-escalation steps in our Customer Service     │
│ guide. Key points: listen first, acknowledge        │
│ their concern, then offer solutions..."             │
│                                                     │
│ 📄 Related Articles:                                │
│ ├─ Customer Service Best Practices                  │
│ ├─ Handling Complaints                              │
│ └─ When to Escalate to Management                   │
└─────────────────────────────────────────────────────┘
```

### Mobile View

```
┌─────────────────────────┐
│ KNOWLEDGE BASE      [×] │
├─────────────────────────┤
│ [🔍 Search...        ]  │
├─────────────────────────┤
│ 📌 Pinned           [2] │
│ 🛡️ Safety           [3] │
│ 🔧 Procedures       [8] │
│ 👷 Vendors         [12] │
│ 📝 Templates        [5] │
│ 💡 Tips             [7] │
└─────────────────────────┘
```

---

## Offline Mode

### How It Works

1. User enables "Offline Mode" in settings
2. Extension downloads all articles to local storage
3. Periodically syncs changes when online
4. Offline indicator shows when using cached data

```
┌─────────────────────────────────────────┐
│ ⚡ OFFLINE MODE                          │
│ Using cached data from 2 hours ago      │
│ [Sync Now]                              │
└─────────────────────────────────────────┘
```

### Cache Strategy

- Cache all articles on initial sync
- Store in IndexedDB (larger storage than localStorage)
- Background sync every 30 minutes when online
- Manual "Sync Now" button
- Clear cache option in settings

---

## QR Code Feature (P2)

### Use Case

Print QR codes and post at relevant locations:
- Safety procedure QR on the job site trailer
- Equipment operation QR on machinery
- Process QR in the office

### Flow

```
Admin creates article
         ↓
Clicks "Generate QR Code"
         ↓
Downloads/prints QR image
         ↓
Posts at relevant location
         ↓
Worker scans with phone
         ↓
Opens article directly (deep link)
```

---

## Rollout Plan

### Phase 1: MVP
- Articles with categories
- Full-text search
- Basic CRUD operations
- Mobile access
- Sync across browsers

### Phase 2: AI & Offline
- AI-powered natural language search
- MCP server integration
- Offline mode with caching
- Video embeds

### Phase 3: Advanced
- QR codes
- Version history
- Read receipts
- Decision trees

---

## Success Metrics

- Adoption: % of Power User orgs with Knowledge Base enabled
- Content: Articles created per org
- Engagement: Searches per user per week
- AI usage: % of searches using AI vs. keyword
- Mobile: % of access from mobile devices
- Utility: Reduction in repeated questions (survey)

---

## Privacy & Access Control

**Knowledge Base articles:**
- Stored in `kb_articles` table
- Access controlled by `org_id` — only org members can read/write
- All org members see all articles (no per-article permissions in MVP)
- Shared across the organization by design

**Data access:**

| Data Type | Who Can Read? |
|-----------|---------------|
| Articles | All org members |
| Categories | All org members |
| Edit history | All org members |
| Read receipts | All org members (when implemented) |

See Terms of Service disclaimer in `user-accounts-spec.md`.

---

## Open Questions

1. Who can create/edit articles? Everyone, or just admins?
2. Should we support article approval workflow?
3. Max article size? Max articles per org?
4. Should categories be customizable by all users or just admins?
5. How do we handle article deletion? Soft delete?

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Low adoption | Pre-populate with template articles |
| Outdated content | "Last updated" prominently displayed, review reminders |
| Information overload | Good categorization, pinned articles, search |
| Offline sync conflicts | Last-write-wins, or show conflict UI |
| Large orgs = many articles | Pagination, category filtering, search |

---

## Comparison: Team Notes vs Knowledge Base

The original "Team Notes" concept has evolved:

| Team Notes (v1) | Knowledge Base (v2) |
|-----------------|---------------------|
| Quick notes | Structured articles |
| Job-linked | Company-wide |
| Competes with JobTread | Complements JobTread |
| Informal | Formal procedures + informal tips |
| No search | Full-text + AI search |
| Basic UI | Categorized, searchable, mobile-optimized |

The Knowledge Base is a more valuable, differentiated feature that fills a real gap.

