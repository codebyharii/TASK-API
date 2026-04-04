const taskService = require('../src/services/taskService');

// Reset the in-memory store before each test so tests don't bleed into each other
beforeEach(() => {
  taskService._reset();
});

// ─── create ───────────────────────────────────────────────────────────────────

describe('create', () => {
  it('creates a task with only title (uses defaults for other fields)', () => {
    const task = taskService.create({ title: 'Buy milk' });
    expect(task.title).toBe('Buy milk');
    expect(task.status).toBe('todo');
    expect(task.priority).toBe('medium');
    expect(task.description).toBe('');
    expect(task.dueDate).toBeNull();
    expect(task.completedAt).toBeNull();
    expect(task.assignee).toBeNull();
    expect(task.id).toBeDefined();
    expect(task.createdAt).toBeDefined();
  });

  it('creates a task with all fields provided', () => {
    const task = taskService.create({
      title: 'Deploy app',
      description: 'Push to prod',
      status: 'in_progress',
      priority: 'high',
      dueDate: '2025-12-31T00:00:00.000Z',
    });
    expect(task.title).toBe('Deploy app');
    expect(task.status).toBe('in_progress');
    expect(task.priority).toBe('high');
    expect(task.dueDate).toBe('2025-12-31T00:00:00.000Z');
  });

  it('assigns a unique id to each task', () => {
    const a = taskService.create({ title: 'Task A' });
    const b = taskService.create({ title: 'Task B' });
    expect(a.id).not.toBe(b.id);
  });
});

// ─── getAll ───────────────────────────────────────────────────────────────────

describe('getAll', () => {
  it('returns empty array when no tasks exist', () => {
    expect(taskService.getAll()).toEqual([]);
  });

  it('returns all created tasks', () => {
    taskService.create({ title: 'A' });
    taskService.create({ title: 'B' });
    expect(taskService.getAll()).toHaveLength(2);
  });

  it('returns a copy — mutating the result does not affect the store', () => {
    taskService.create({ title: 'A' });
    const all = taskService.getAll();
    all.push({ id: 'injected' });
    expect(taskService.getAll()).toHaveLength(1);
  });
});

// ─── findById ─────────────────────────────────────────────────────────────────

describe('findById', () => {
  it('returns the task with the given id', () => {
    const task = taskService.create({ title: 'Find me' });
    expect(taskService.findById(task.id)).toMatchObject({ title: 'Find me' });
  });

  it('returns undefined for a non-existent id', () => {
    expect(taskService.findById('does-not-exist')).toBeUndefined();
  });
});

// ─── getByStatus ──────────────────────────────────────────────────────────────

describe('getByStatus', () => {
  beforeEach(() => {
    taskService.create({ title: 'A', status: 'todo' });
    taskService.create({ title: 'B', status: 'in_progress' });
    taskService.create({ title: 'C', status: 'done' });
  });

  it('returns only tasks with the exact matching status', () => {
    const result = taskService.getByStatus('todo');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('A');
  });

  it('BUG 1 FIX — does not do partial/substring matching', () => {
    // Old code: t.status.includes(status) → 'in' matched 'in_progress'
    // Fixed code: t.status === status → 'in' matches nothing
    const result = taskService.getByStatus('in');
    expect(result).toHaveLength(0);
  });

  it('returns empty array when no tasks have that status', () => {
    taskService._reset();
    expect(taskService.getByStatus('todo')).toHaveLength(0);
  });
});

// ─── getPaginated ─────────────────────────────────────────────────────────────

describe('getPaginated', () => {
  beforeEach(() => {
    for (let i = 1; i <= 15; i++) {
      taskService.create({ title: `Task ${i}` });
    }
  });

  it('BUG 2 FIX — page 1 returns the FIRST items, not skipping them', () => {
    // Old code: offset = page * limit → page=1,limit=10 → offset=10 (skips first 10!)
    // Fixed code: offset = (page - 1) * limit → offset=0 → returns items 1-10
    const result = taskService.getPaginated(1, 10);
    expect(result).toHaveLength(10);
    expect(result[0].title).toBe('Task 1');
  });

  it('page 2 returns the next set of items', () => {
    const result = taskService.getPaginated(2, 10);
    expect(result).toHaveLength(5);
    expect(result[0].title).toBe('Task 11');
  });

  it('returns empty array when page exceeds available data', () => {
    const result = taskService.getPaginated(99, 10);
    expect(result).toHaveLength(0);
  });
});

// ─── getStats ─────────────────────────────────────────────────────────────────

describe('getStats', () => {
  it('returns zero counts when store is empty', () => {
    expect(taskService.getStats()).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });

  it('counts tasks by status correctly', () => {
    taskService.create({ title: 'A', status: 'todo' });
    taskService.create({ title: 'B', status: 'in_progress' });
    taskService.create({ title: 'C', status: 'done' });
    const stats = taskService.getStats();
    expect(stats.todo).toBe(1);
    expect(stats.in_progress).toBe(1);
    expect(stats.done).toBe(1);
  });

  it('counts overdue tasks (past dueDate and not done)', () => {
    taskService.create({ title: 'Overdue', status: 'todo', dueDate: '2000-01-01T00:00:00.000Z' });
    expect(taskService.getStats().overdue).toBe(1);
  });

  it('does NOT count a "done" task as overdue even if dueDate has passed', () => {
    taskService.create({ title: 'Done late', status: 'done', dueDate: '2000-01-01T00:00:00.000Z' });
    expect(taskService.getStats().overdue).toBe(0);
  });

  it('does not count future due dates as overdue', () => {
    taskService.create({ title: 'Future', status: 'todo', dueDate: '2099-01-01T00:00:00.000Z' });
    expect(taskService.getStats().overdue).toBe(0);
  });
});

// ─── update ───────────────────────────────────────────────────────────────────

describe('update', () => {
  it('updates only the specified fields', () => {
    const task = taskService.create({ title: 'Old title', priority: 'high' });
    const updated = taskService.update(task.id, { title: 'New title', status: 'done' });
    expect(updated.title).toBe('New title');
    expect(updated.status).toBe('done');
    expect(updated.priority).toBe('high'); // unchanged
  });

  it('returns null for a non-existent id', () => {
    expect(taskService.update('bad-id', { title: 'x' })).toBeNull();
  });
});

// ─── remove ───────────────────────────────────────────────────────────────────

describe('remove', () => {
  it('removes an existing task and returns true', () => {
    const task = taskService.create({ title: 'Delete me' });
    expect(taskService.remove(task.id)).toBe(true);
    expect(taskService.getAll()).toHaveLength(0);
  });

  it('returns false for a non-existent id', () => {
    expect(taskService.remove('nope')).toBe(false);
  });
});

// ─── completeTask ─────────────────────────────────────────────────────────────

describe('completeTask', () => {
  it('sets status to done and records completedAt', () => {
    const task = taskService.create({ title: 'Finish me' });
    const completed = taskService.completeTask(task.id);
    expect(completed.status).toBe('done');
    expect(completed.completedAt).not.toBeNull();
  });

  it('BUG 3 FIX — preserves original priority, does NOT reset to medium', () => {
    // Old code: hardcoded priority: 'medium' inside completeTask
    // Fixed: priority is no longer overridden on completion
    const task = taskService.create({ title: 'Urgent task', priority: 'high' });
    const completed = taskService.completeTask(task.id);
    expect(completed.priority).toBe('high');
  });

  it('returns null for a non-existent id', () => {
    expect(taskService.completeTask('ghost')).toBeNull();
  });
});

// ─── assignTask ───────────────────────────────────────────────────────────────

describe('assignTask', () => {
  it('assigns a task to a person', () => {
    const task = taskService.create({ title: 'Do something' });
    const updated = taskService.assignTask(task.id, 'Alice');
    expect(updated.assignee).toBe('Alice');
  });

  it('allows reassigning to a different person (overwrites)', () => {
    const task = taskService.create({ title: 'Do something' });
    taskService.assignTask(task.id, 'Alice');
    const updated = taskService.assignTask(task.id, 'Bob');
    expect(updated.assignee).toBe('Bob');
  });

  it('returns null for a non-existent task id', () => {
    expect(taskService.assignTask('no-such-id', 'Alice')).toBeNull();
  });

  it('preserves all other task fields when assigning', () => {
    const task = taskService.create({ title: 'Keep fields', priority: 'high', status: 'in_progress' });
    const updated = taskService.assignTask(task.id, 'Alice');
    expect(updated.title).toBe('Keep fields');
    expect(updated.priority).toBe('high');
    expect(updated.status).toBe('in_progress');
  });
});
