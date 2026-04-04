# Task Manager API — Submission

## Setup

```bash
cd task-api
npm install
npm start        # runs on http://localhost:3000
npm test         # run all tests
npm run coverage # tests + coverage report
```

## What was done

### Day 1 — Tests
- `tests/taskService.test.js` — unit tests for all service functions
- `tests/tasks.routes.test.js` — integration tests for all 8 API routes using Supertest
- Happy path + edge cases covered for every endpoint
- Tests explicitly call out each bug found (labelled BUG 1/2/3 FIX in comments)

### Day 2 — Bugs & Feature

**3 bugs found** (see `BUG_REPORT.md` for full details):

| # | Location | Issue |
|---|----------|-------|
| 1 | `taskService.getByStatus` | Uses `.includes()` (substring match) instead of `===` (exact match) |
| 2 | `taskService.getPaginated` | Offset formula `page * limit` skips page 1 entirely |
| 3 | `taskService.completeTask` | Hardcodes `priority: 'medium'`, silently downgrading high-priority tasks |

**Bug fixed:** Bug 2 (pagination) — changed `offset = page * limit` to `offset = (page - 1) * limit`

**New feature:** `PATCH /tasks/:id/assign`
- Accepts `{ "assignee": "string" }` and stores it on the task
- Returns the updated task
- Returns 404 if task not found
- Returns 400 if assignee is missing, not a string, or empty/whitespace
- Allows reassigning (overwrites existing assignee)
- Trims whitespace from the name before saving

## Project structure

```
task-api/
  src/
    app.js                   # Express app
    routes/tasks.js          # All route handlers (including new /assign)
    services/taskService.js  # Business logic — bugs fixed here
    utils/validators.js      # Input validation
  tests/
    taskService.test.js      # Unit tests
    tasks.routes.test.js     # Integration tests
  BUG_REPORT.md              # Full bug report with fixes and notes
  package.json
  jest.config.js
```
"# TASK-API" 
