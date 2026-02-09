# Schedule Assistant — Feature Specification

**Version:** 1.0 Draft
**Tier:** Power User
**Status:** Planning
**Dependencies:** User Accounts (Foundation), Pave API (task queries), DOM injection on Schedule/Availability view

---

## Overview

Schedule Assistant enhances JobTread's Availability view by adding an "Unassigned Tasks" row that shows tasks needing coverage. This gives project managers a complete picture: who's available, who's assigned, and what still needs people — all in one view.

---

## Problem Statement

1. **Blind spots** — Availability view only shows where people ARE assigned, not what NEEDS assignment
2. **Context switching** — To find unassigned tasks, you must leave this view and search elsewhere
3. **No task pool** — Can't see tasks by date that need coverage
4. **Manual coordination** — PMs must mentally track "what's uncovered" across multiple screens

---

## Solution

An injected row above the team list that displays:
- Tasks from published schedules
- Filtered by task type (Labor, Time Off, Delivery, etc.)
- Showing what needs assignment
- Enabling quick assignment without leaving the view

---

## User Stories

### Core Workflow
- As a PM, I want to see unassigned tasks alongside team availability
- As a PM, I want to filter the task pool by task type
- As a PM, I want to click a task and assign it to a team member
- As a PM, I want to click an empty day on someone's row and see what tasks are available

### Discovery
- As a PM, I want to know how many tasks need coverage each day
- As a PM, I want to quickly identify scheduling gaps

### Assignment
- As a PM, I want to assign a task from the pool to a team member
- As a PM, I want to reassign tasks between team members (future)

---

## Feature Requirements

### P0 — Must Have (MVP)

| Feature | Description |
|---------|-------------|
| Unassigned Tasks row | Injected row above "INTERNAL" section |
| Task type filter | Multi-select to filter which task types appear |
| Date-mapped tasks | Tasks appear in correct day columns |
| Task count badges | Show count when multiple tasks on same day |
| Click to expand | Click badge/cell to see task list |
| Task details | View task name, job, and basic info |

### P1 — Should Have

| Feature | Description |
|---------|-------------|
| Quick assign | Assign task to team member from expanded view |
| Empty cell click | Click empty cell on team row → see assignable tasks |
| Visual indicators | Color coding by task type |
| Job links | Click task to go to job in JobTread |

### P2 — Nice to Have

| Feature | Description |
|---------|-------------|
| Drag and drop | Drag task from pool to team member row |
| Reassignment | Move tasks between team members |
| Conflict detection | Warn if assigning to someone already busy |
| Week navigation | Next/previous week with task data |
| Unassigned count | Total unassigned badge in header |

---

## Technical Architecture

### Data Flow

```
┌─────────────────────┐
│ JobTread Pave API   │
│ - Get all tasks     │
│ - Filter by type    │
│ - Filter by date    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Cloudflare Worker   │
│ (proxy & cache)     │
│ - Auth via token    │
│ - Grant key from DB │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Extension           │
│ - Query tasks       │
│ - Inject UI row     │
│ - Handle clicks     │
│ - Assignment calls  │
└─────────────────────┘
```

### Authentication

**Prerequisite:** User Accounts system (see `user-accounts-spec.md`)

- User must be logged in with a User Account
- Extension sends `Authorization: Bearer <access_token>` with API requests
- Worker validates token, retrieves user's stored `grant_key` from DB
- Worker uses decrypted `grant_key` to make Pave API calls
- No grant key stored locally — pulled from server on each session

### API Requirements

**Read Operations (Required for MVP):**
```graphql
# Get tasks by date range
query GetTasks($startDate: Date!, $endDate: Date!) {
  tasks(
    filter: {
      scheduledStart: { gte: $startDate, lte: $endDate }
    }
  ) {
    id
    name
    taskType { id, name }
    job { id, name }
    scheduledStart
    scheduledEnd
    assignees { id, name }
  }
}

# Get task types for filter
query GetTaskTypes {
  taskTypes {
    id
    name
  }
}
```

**Write Operations (Required for assignment):**
```graphql
# Assign user to task
mutation AssignTask($taskId: ID!, $userId: ID!) {
  updateTask(id: $taskId, assignees: [$userId]) {
    id
    assignees { id, name }
  }
}
```

**Unknowns to Verify:**
- [ ] Can we query tasks across all jobs by date range?
- [ ] Can we filter by assignee (unassigned)?
- [ ] Can we update task assignments via API?
- [ ] What are the rate limits?

### DOM Injection Points

**Target Page:** `app.jobtread.com/*/schedule` (Availability view)

**Injection Strategy:**
1. Wait for schedule grid to render
2. Find the "INTERNAL" section header
3. Insert new row above it
4. Match existing grid column structure
5. Observe for navigation/re-renders

**Key DOM Elements:**
```
Schedule container
├── Header row (SUN MON TUE WED THU FRI SAT)
├── [INJECT HERE] → Task Pool row
├── INTERNAL section
│   ├── Team member rows
│   └── ...
└── Other sections
```

### Caching Strategy

- Cache task data for current week view
- Invalidate on:
  - Manual refresh
  - Assignment action
  - Navigation to different week
- TTL: 2 minutes (balance freshness vs. API calls)

---

## UI/UX Design

### Injected Row Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚙️ TASK POOL  [Labor ✓] [Time Off ✓] [Delivery ☐]   [↻ Refresh]│
├─────────────────────────────────────────────────────────────────┤
│              SUN    MON    TUE    WED    THU    FRI    SAT      │
│              [2]    [1]           [3]    [1]    [4]             │
└─────────────────────────────────────────────────────────────────┘
```

### Task Cell States

```
Empty day:        (blank)
Single task:      [Task name truncated...]
Multiple tasks:   [3] (count badge)
```

### Expanded Task List (on click)

```
┌─────────────────────────────────┐
│ Monday, Jan 26           [×]   │
├─────────────────────────────────┤
│ ☐ Framing                       │
│   Smith Residence               │
│   [View Job] [Assign ▾]         │
├─────────────────────────────────┤
│ ☐ Material Delivery             │
│   Johnson Remodel               │
│   [View Job] [Assign ▾]         │
└─────────────────────────────────┘
```

### Assign Dropdown

```
[Assign ▾]
┌─────────────────────────────────┐
│ Ben Ragan                       │
│ Tommy ...                       │
│ Warren ...                      │
│ Jose ... (busy)                 │
│ Kyle ...                        │
└─────────────────────────────────┘
```

### Filter Bar

```
Task Types: [Labor ✓] [Time Off ✓] [Inspection ☐] [Delivery ☐] [+ More]
            [Show assigned too ☐]
```

---

## Interaction Flows

### Flow 1: View Unassigned Tasks

1. User opens Schedule → Availability view
2. Extension detects page, injects Task Pool row
3. Extension queries tasks for visible date range
4. Tasks populate in appropriate day columns
5. User sees the full picture

### Flow 2: Assign a Task

1. User clicks [2] badge on Monday
2. Expanded view shows 2 tasks
3. User clicks [Assign ▾] on "Framing"
4. Dropdown shows available team members
5. User selects "Ben Ragan"
6. Extension calls API to assign
7. Task moves from pool to Ben's row
8. UI updates optimistically

### Flow 3: Empty Cell Discovery

1. User notices Ben has nothing on Tuesday
2. User clicks Ben's empty Tuesday cell
3. Modal shows: "3 tasks available for Tuesday"
4. User can assign one directly

---

## Integration Points

### With JobTread Schedule View
- Matches existing grid column widths
- Uses consistent styling/colors
- Respects current week/date range

### With Team Member Rows
- Knows which user IDs map to which rows
- Can highlight target row on hover during assign

### With Job Pages
- "View Job" link navigates to job in JobTread
- Opens in same tab or new tab (configurable)

---

## Settings & Configuration

```
SCHEDULE ASSISTANT
─────────────────────────────
☑ Enable Schedule Assistant

Default task type filters:
☑ Labor
☑ Time Off
☐ Inspection
☐ Delivery
☐ Meeting

☐ Show already-assigned tasks in pool
☐ Auto-refresh every 5 minutes
```

---

## Rollout Plan

### Phase 1: Read-Only MVP
- Injected Task Pool row
- Task type filtering
- Click to expand task list
- View task details
- Link to job

### Phase 2: Assignment
- Quick assign from expanded view
- Empty cell click → available tasks
- Optimistic UI updates

### Phase 3: Advanced
- Drag and drop
- Conflict detection
- Week navigation with data
- Reassignment between users

---

## Success Metrics

- Adoption: % of Power User orgs with Schedule Assistant enabled
- Engagement: Assignments made through the feature per week
- Efficiency: Time to assign tasks (if measurable)
- Satisfaction: User feedback / NPS

---

## Open Questions

1. Does Pave API support task queries by date range across all jobs?
2. Can we update task assignments via API?
3. How do we handle tasks that span multiple days?
4. Should we show completed tasks or hide them?
5. How do we handle orgs with 100+ unassigned tasks?

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Pave API doesn't support needed queries | Verify API capabilities before building |
| DOM structure changes break injection | Robust selectors, error handling, quick patch process |
| Too many tasks = performance issues | Pagination, date range limits, lazy loading |
| Assignment fails silently | Optimistic UI with rollback on failure, toast notifications |
| Rate limiting | Cache aggressively, batch requests where possible |

---

## Technical Spikes Needed

Before committing to build:

1. **API Verification**
   - [ ] Query tasks by date range (all jobs)
   - [ ] Filter by assignment status
   - [ ] Update task assignments
   - [ ] Get task types

2. **DOM Analysis**
   - [ ] Map schedule grid structure
   - [ ] Identify stable selectors
   - [ ] Test injection across different orgs

3. **Performance Testing**
   - [ ] Load test with large task counts
   - [ ] Measure API response times
   - [ ] Test caching effectiveness

