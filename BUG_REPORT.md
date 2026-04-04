# Bug Report — Task Manager API

---

## Bug 1 — `getByStatus` uses substring matching instead of exact match

**File:** `src/services/taskService.js`

**Expected behaviour:**
`GET /tasks?status=todo` should return only tasks whose `status` is exactly `"todo"`.

**What actually happens:**
`t.status.includes(status)` performs substring matching, not equality.
For example, querying with `status=in` would match tasks with `status: "in_progress"` because `"in"` is a substring of `"in_progress"`. A caller filtering for `"in"` would silently receive tasks they didn't ask for.

**How I discovered it:**
Reading the source code — `.includes()` on a string checks for substrings, not equality.

**Buggy line:**
```js
const getByStatus = (status) => tasks.filter((t) => t.status.includes(status));
```

**Fix:**
```js
const getByStatus = (status) => tasks.filter((t) => t.status === status);
```

---

## Bug 2 — `getPaginated` offset is off by one page (FIXED ✅)

**File:** `src/services/taskService.js`

**Expected behaviour:**
`GET /tasks?page=1&limit=10` should return items 1–10.
`GET /tasks?page=2&limit=10` should return items 11–20.

**What actually happens:**
The offset was calculated as `page * limit`:

| page | limit | offset (old) | items returned |
|------|-------|-------------|----------------|
| 1    | 10    | 10          | items 11–20 ❌  |
| 2    | 10    | 20          | items 21–30 ❌  |

Page 1 entirely skips the first 10 items. There is no way to retrieve the first page of results using the old formula.

**How I discovered it:**
Wrote a test: created 15 tasks, requested `page=1&limit=10`, and asserted `result[0].title === 'Task 1'`. The test failed — the first item returned was `'Task 11'`.

**Buggy line:**
```js
const offset = page * limit;
```

**Fix:**
```js
const offset = (page - 1) * limit;
```

**Status:** ✅ Fixed in `src/services/taskService.js`

---

## Bug 3 — `completeTask` silently resets priority to `'medium'`

**File:** `src/services/taskService.js`

**Expected behaviour:**
`PATCH /tasks/:id/complete` should set `status` to `"done"` and record `completedAt`. No other fields should change.

**What actually happens:**
The function hardcodes `priority: 'medium'` in the updated task object, regardless of the task's existing priority:

```js
const updated = {
  ...task,
  priority: 'medium',   // ← always overwrites original priority!
  status: 'done',
  completedAt: new Date().toISOString(),
};
```

A `high`-priority task is silently downgraded to `medium` the moment it is completed. This corrupts data — any downstream system reading priority (reporting, dashboards, exports) will see incorrect values.

**How I discovered it:**
Created a `high`-priority task, called complete, and asserted `result.priority === 'high'`. The test failed with `'medium'`.

**Fix:**
Remove the `priority` line entirely — spread the original task and only override what should change:

```js
const updated = {
  ...task,
  status: 'done',
  completedAt: new Date().toISOString(),
};
```

---

## Fix chosen for Part B

**Bug 2 (pagination offset)** was fixed because it has the clearest correct specification, is provably broken for all users of pagination, and has a simple one-line fix with high confidence.

---

## Submission notes

### What I'd test next with more time
- Calling `PATCH /tasks/:id/complete` on a task that is already `done` (should it be idempotent, or return a conflict?)
- Negative or zero values for `page` and `limit`
- Tasks with `dueDate` exactly equal to the current timestamp (boundary condition for overdue)
- Full end-to-end flow: create → assign → complete → verify stats reflects correctly
- Concurrent updates to the same task ID (the in-memory store has no locking)

### What surprised me in the codebase
The `completeTask` bug (Bug 3) was the most surprising — it's not obvious from the route name that completing a task would change its priority. It looks like `priority: 'medium'` was probably a leftover from copy-pasting a default create object and was never noticed because no test existed to catch it.

### Questions I'd ask before shipping to production
1. **Is pagination 1-indexed by spec?** The route defaults suggest page=1 means the first page, but the original offset formula was 0-indexed. Worth confirming with the team to ensure client apps agree.
2. **Should completing a task be idempotent?** Currently calling it twice updates `completedAt` each time. Should it return 409 or skip silently if already done?
3. **Should `assignee` be a free-form name or a user ID?** Free-form names can't be validated against real users and drift over time (typos, name changes). A user ID referencing a users table would be more robust for production.
4. **Is the in-memory store intentional for production?** All data is lost on server restart. Is a persistence layer (database) planned?
