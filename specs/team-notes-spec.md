# Team Notes — Feature Specification

**Version:** 1.0 Draft
**Tier:** Power User
**Status:** Planning
**Dependencies:** User Accounts (Foundation), Quick Notes (Essential), Cloudflare D1, Pave API

---

## Overview

Team Notes is a shared workspace that allows everyone in an organization to collaborate on notes directly inside JobTread. Unlike Quick Notes (which is personal and local), Team Notes syncs across all devices and browsers, and can be linked to specific jobs and contacts.

---

## Problem Statement

1. **Knowledge silos** — Important job information lives in individual people's heads or personal notes
2. **Handoff friction** — When someone else takes over a job, context is lost
3. **No shared memory** — Teams repeatedly ask "did anyone write this down?"
4. **Cross-browser sync** — Personal Quick Notes don't sync between Chrome, Edge, Firefox, etc.

---

## Solution

A shared, API-powered notes system that:
- Lives alongside Quick Notes as a premium upgrade
- Syncs to Cloudflare D1 (accessible from any browser)
- Can be linked to specific JobTread jobs and contacts
- Shows relevant notes automatically based on context
- Attributes notes to team members via nicknames

---

## User Stories

### Basic Usage
- As a team member, I want to write a note that my whole team can see
- As a team member, I want to see notes organized by groups/folders
- As a team member, I want to know who wrote a note and when

### Job Context
- As a project manager, I want to attach notes to specific jobs
- As a field worker, I want to see all notes for the job I'm currently viewing
- As anyone, I want notes for the current job to surface automatically

### Contact Context
- As a sales person, I want to note things about specific clients
- As a project manager, I want to see notes about vendors/subs

### Search & Discovery
- As a team member, I want to search across all Team Notes
- As a team member, I want to filter notes by job or contact

---

## Feature Requirements

### P0 — Must Have (MVP)

| Feature | Description |
|---------|-------------|
| Shared notes | Notes visible to all users with org's license |
| Nickname attribution | "— Mike, Jan 15" on each note |
| Groups/folders | Organize notes into categories |
| Basic CRUD | Create, read, update, delete notes |
| Separate toggle | Enable/disable independently from other features |
| Sync across browsers | Same notes on Chrome, Edge, Firefox, mobile |

### P1 — Should Have

| Feature | Description |
|---------|-------------|
| Job linking | Attach notes to specific jobs via job picker |
| Auto-context | Badge/highlight when notes exist for current job |
| @mentions for jobs | Type `@` to reference a job inline |
| Insert job details | Button to pull job info into note |

### P2 — Nice to Have

| Feature | Description |
|---------|-------------|
| Contact linking | Attach notes to clients/vendors/subs |
| @mentions for contacts | Type `@` to reference contacts inline |
| Note → Task | Convert a note into a JobTread task |
| Filter by job status | Show notes for active/completed jobs |
| Search | Full-text search across all Team Notes |
| Rich text | Bold, italic, lists in notes |

---

## Technical Architecture

### Data Model

```sql
-- Cloudflare D1 Tables
-- Note: users and licenses tables defined in user-accounts-spec.md

CREATE TABLE team_notes (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  group_id TEXT,
  content TEXT NOT NULL,
  author_user_id TEXT NOT NULL,   -- FK to users table
  author_display_name TEXT,       -- Cached for display (denormalized)
  job_id TEXT,                    -- Optional: linked JobTread job
  contact_id TEXT,                -- Optional: linked JobTread contact
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (author_user_id) REFERENCES users(id)
);

CREATE TABLE team_note_groups (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER,
  created_at INTEGER
);

CREATE INDEX idx_notes_org ON team_notes(org_id);
CREATE INDEX idx_notes_job ON team_notes(job_id);
CREATE INDEX idx_notes_contact ON team_notes(contact_id);
CREATE INDEX idx_notes_author ON team_notes(author_user_id);
```

**Note:** Personal notes use the `user_notes` table defined in `user-accounts-spec.md`.

### API Endpoints (Cloudflare Worker)

All endpoints require `Authorization: Bearer <access_token>` header.

```
Team Notes (org-wide):
POST   /team-notes/list          — Get all Team Notes for org
POST   /team-notes/create        — Create new Team Note
POST   /team-notes/update        — Update existing Team Note
POST   /team-notes/delete        — Delete Team Note
POST   /team-notes/groups/list   — Get all groups for org
POST   /team-notes/groups/create — Create new group
POST   /team-notes/by-job        — Get Team Notes for specific job
POST   /team-notes/by-contact    — Get Team Notes for specific contact
POST   /team-notes/search        — Search Team Notes (P2)

Personal Notes (user-specific, via User Accounts):
GET    /sync/notes               — Get personal notes
POST   /sync/notes               — Save personal notes
```

### Authentication

**Prerequisite:** User Accounts system (see `user-accounts-spec.md`)

- User must be logged in with a User Account
- Request includes: `Authorization: Bearer <access_token>`
- Worker validates:
  - Token is valid and not expired
  - User's license is active and Power User tier
- `org_id` extracted from user's license relationship
- All Team Notes operations scoped to that org

### Identity

- User identity comes from the User Account system
- `user.display_name` is used for note attribution
- No separate nickname needed — set during account creation
- Display name can be updated in account settings

### Personal Notes Sync

With User Accounts, personal Quick Notes can also sync:
- Personal notes stored in `user_notes` table (see `user-accounts-spec.md`)
- Only visible to that user (scoped by `user_id`)
- Syncs across all browsers where user is logged in

### Encryption & Privacy

**Personal Notes:** End-to-end encrypted (see `user-accounts-spec.md`)
- Server stores encrypted blobs it cannot read
- Only the user can decrypt with their password-derived key
- Admin cannot see personal note content

**Team Notes:** NOT end-to-end encrypted
- Team Notes are shared across the org, so all org members need to read them
- Server stores plaintext content
- Scoped by `org_id` — only org members can access via API
- Admin *could* read Team Notes content (but shouldn't need to)

**Why Team Notes aren't E2E encrypted:**
- E2E encryption requires a shared key
- Key would need to be distributed to all org members
- Key rotation when someone leaves is complex
- Tradeoff: Team Notes are access-controlled but not encrypted at rest

**Data minimization:**
- We only store what's necessary
- No analytics on note content
- No indexing of personal note content (it's encrypted anyway)
- Team Note content is only indexed for search functionality

| Data Type | Encrypted at Rest? | Who Can Read? |
|-----------|-------------------|---------------|
| Personal Notes | ✅ E2E encrypted | Only the user |
| Personal Templates | ✅ E2E encrypted | Only the user |
| Team Notes | ❌ Plaintext | Org members via API |
| Job/Contact links | ❌ Plaintext | Org members via API |
| Display names | ❌ Plaintext | Anyone with access |

### Data Scoping

```
User Account (mike@titus.com)
├── user_id: "user_abc123"
├── license_id → licenses.id → org_id: "titus_org"
│
├── Personal Notes (only Mike sees)
│   └── user_notes WHERE user_id = "user_abc123"
│
└── Team Notes (whole org sees)
    └── team_notes WHERE org_id = "titus_org"
```

---

## UI/UX Design

### Panel Layout

```
┌─────────────────────────────────────────┐
│ NOTES                    [Personal][Team]│
├─────────────────────────────────────────┤
│ 📁 General                          [+] │
│ ├─ Note about something...              │
│ │                        — Mike, Jan 15 │
│ ├─ Another note here...                 │
│ │                        — Sarah, Jan 12│
├─────────────────────────────────────────┤
│ 📁 Job Handoffs                     [+] │
│ ├─ 🏠 Smith Residence                   │
│ │   Gate code 4421, AM delivery pref    │
│ │                        — Mike, Jan 10 │
├─────────────────────────────────────────┤
│ [+ New Note]  [+ New Group]             │
└─────────────────────────────────────────┘
```

### Job Linking UI

When creating/editing a note:
```
┌─────────────────────────────────────────┐
│ New Note                                │
├─────────────────────────────────────────┤
│ [Note content here...]                  │
│                                         │
│ Group: [General        ▾]               │
│ Link to Job: [Search jobs...    ] [×]   │
│                                         │
│ [Cancel]                    [Save Note] │
└─────────────────────────────────────────┘
```

### Auto-Context Indicator

When on a job page with linked notes:
```
┌──────────────────┐
│ 📝 Notes [3]     │  ← Badge shows count
└──────────────────┘
```

Click to open panel filtered to that job's notes.

---

## Integration Points

### With Quick Notes (Essential)
- Same panel, tabbed interface: `[Personal] [Team]`
- Personal tab = existing Quick Notes (local storage)
- Team tab = Team Notes (API-powered)
- Users can use both

### With JobTread Pages
- Detect current job from URL: `/jobs/{job_id}`
- Query Team Notes for that `job_id`
- Show indicator if notes exist
- Auto-filter panel to relevant notes

### With Job Picker
- Reuse existing job search from Custom Field Filter
- `getAllJobs` or `searchJobs` endpoint
- Autocomplete as user types

---

## Rollout Plan

### Phase 1: MVP
- Basic shared notes with groups
- Nickname attribution
- Sync across browsers
- Toggle in settings

### Phase 2: Job Integration
- Job linking
- Auto-context badges
- @mentions for jobs

### Phase 3: Advanced
- Contact linking
- Search
- Note → Task conversion

---

## Success Metrics

- Adoption: % of Power User orgs with Team Notes enabled
- Engagement: Notes created per org per week
- Retention: Do orgs with Team Notes have lower churn?
- Feature depth: % of notes linked to jobs vs. general

---

## Open Questions

1. Should there be note-level permissions (private vs. shared)?
2. Max note length? Max notes per org?
3. Should we support note comments/replies?
4. Archive vs. delete — soft delete for recovery?
5. Rate limiting on API calls?

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Nickname collisions ("two Mikes") | Show timestamp, let users pick unique names |
| Data loss on API failure | Optimistic UI with retry queue |
| Large orgs = lots of notes | Pagination, lazy loading |
| Abuse/spam | Rate limiting, note size limits |

