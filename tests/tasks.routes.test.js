const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

// Reset store before each test to ensure isolation
beforeEach(() => {
  taskService._reset();
});

// ─── GET /tasks ───────────────────────────────────────────────────────────────

describe('GET /tasks', () => {
  it('returns 200 and empty array when no tasks exist', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all tasks', async () => {
    await request(app).post('/tasks').send({ title: 'A' });
    await request(app).post('/tasks').send({ title: 'B' });
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

// ─── GET /tasks?status= ───────────────────────────────────────────────────────

describe('GET /tasks?status=', () => {
  beforeEach(async () => {
    await request(app).post('/tasks').send({ title: 'Todo task', status: 'todo' });
    await request(app).post('/tasks').send({ title: 'In progress task', status: 'in_progress' });
  });

  it('filters tasks by exact status', async () => {
    const res = await request(app).get('/tasks?status=todo');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Todo task');
  });

  it('returns empty array when no tasks match the status', async () => {
    const res = await request(app).get('/tasks?status=done');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('BUG 1 FIX — does not return partial status matches', async () => {
    // 'in' should not match 'in_progress'
    const res = await request(app).get('/tasks?status=in');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

// ─── GET /tasks?page=&limit= ──────────────────────────────────────────────────

describe('GET /tasks?page=&limit=', () => {
  beforeEach(async () => {
    for (let i = 1; i <= 15; i++) {
      await request(app).post('/tasks').send({ title: `Task ${i}` });
    }
  });

  it('BUG 2 FIX — page 1 returns the first items (not skipping them)', async () => {
    const res = await request(app).get('/tasks?page=1&limit=10');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(10);
    expect(res.body[0].title).toBe('Task 1');
  });

  it('page 2 returns the correct next batch', async () => {
    const res = await request(app).get('/tasks?page=2&limit=10');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
    expect(res.body[0].title).toBe('Task 11');
  });

  it('returns empty array for a page beyond the data', async () => {
    const res = await request(app).get('/tasks?page=99&limit=10');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─── GET /tasks/stats ─────────────────────────────────────────────────────────

describe('GET /tasks/stats', () => {
  it('returns zero counts on an empty store', async () => {
    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });

  it('counts tasks by status and overdue correctly', async () => {
    // overdue: past dueDate + not done
    await request(app).post('/tasks').send({ title: 'A', status: 'todo', dueDate: '2000-01-01T00:00:00.000Z' });
    await request(app).post('/tasks').send({ title: 'B', status: 'in_progress' });
    await request(app).post('/tasks').send({ title: 'C', status: 'done' });

    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body.todo).toBe(1);
    expect(res.body.in_progress).toBe(1);
    expect(res.body.done).toBe(1);
    expect(res.body.overdue).toBe(1);
  });
});

// ─── POST /tasks ──────────────────────────────────────────────────────────────

describe('POST /tasks', () => {
  it('creates a task with only a title and returns 201', async () => {
    const res = await request(app).post('/tasks').send({ title: 'My task' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('My task');
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('todo');
    expect(res.body.priority).toBe('medium');
    expect(res.body.assignee).toBeNull();
  });

  it('creates a task with all fields', async () => {
    const res = await request(app).post('/tasks').send({
      title: 'Full task',
      description: 'Details here',
      status: 'in_progress',
      priority: 'high',
      dueDate: '2099-01-01T00:00:00.000Z',
    });
    expect(res.status).toBe(201);
    expect(res.body.priority).toBe('high');
    expect(res.body.status).toBe('in_progress');
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(app).post('/tasks').send({ priority: 'high' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/i);
  });

  it('returns 400 when title is an empty string', async () => {
    const res = await request(app).post('/tasks').send({ title: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid status value', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Bad', status: 'maybe' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status/i);
  });

  it('returns 400 for an invalid priority value', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Bad', priority: 'urgent' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/priority/i);
  });

  it('returns 400 for an invalid dueDate format', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Bad', dueDate: 'not-a-date' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/dueDate/i);
  });
});

// ─── PUT /tasks/:id ───────────────────────────────────────────────────────────

describe('PUT /tasks/:id', () => {
  it('updates a task and returns the updated object', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Old title' });
    const res = await request(app).put(`/tasks/${created.body.id}`).send({ title: 'New title', status: 'done' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New title');
    expect(res.body.status).toBe('done');
  });

  it('returns 404 for a non-existent task id', async () => {
    const res = await request(app).put('/tasks/fake-id').send({ title: 'x' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 400 when title is set to an empty string', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Valid' });
    const res = await request(app).put(`/tasks/${created.body.id}`).send({ title: '' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid status on update', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Valid' });
    const res = await request(app).put(`/tasks/${created.body.id}`).send({ status: 'unknown' });
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /tasks/:id ────────────────────────────────────────────────────────

describe('DELETE /tasks/:id', () => {
  it('deletes a task and returns 204 No Content', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Gone' });
    const res = await request(app).delete(`/tasks/${created.body.id}`);
    expect(res.status).toBe(204);

    const all = await request(app).get('/tasks');
    expect(all.body).toHaveLength(0);
  });

  it('returns 404 when deleting a non-existent task', async () => {
    const res = await request(app).delete('/tasks/ghost-id');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});

// ─── PATCH /tasks/:id/complete ────────────────────────────────────────────────

describe('PATCH /tasks/:id/complete', () => {
  it('marks a task as done and sets completedAt', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Finish me' });
    const res = await request(app).patch(`/tasks/${created.body.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(res.body.completedAt).not.toBeNull();
  });

  it('BUG 3 FIX — does NOT reset priority to medium when completing', async () => {
    // Old code set priority: 'medium' unconditionally inside completeTask
    const created = await request(app).post('/tasks').send({ title: 'Urgent', priority: 'high' });
    const res = await request(app).patch(`/tasks/${created.body.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.priority).toBe('high'); // must stay high
  });

  it('returns 404 for a non-existent task', async () => {
    const res = await request(app).patch('/tasks/nope/complete');
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /tasks/:id/assign ──────────────────────────────────────────────────

describe('PATCH /tasks/:id/assign', () => {
  it('assigns a task to a person and returns the updated task', async () => {
    const created = await request(app).post('/tasks').send({ title: 'My task' });
    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: 'Alice' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Alice');
  });

  it('trims whitespace from the assignee name before saving', async () => {
    const created = await request(app).post('/tasks').send({ title: 'My task' });
    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: '  Bob  ' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Bob');
  });

  it('allows reassigning an already-assigned task (overwrites)', async () => {
    const created = await request(app).post('/tasks').send({ title: 'My task' });
    await request(app).patch(`/tasks/${created.body.id}/assign`).send({ assignee: 'Alice' });
    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: 'Bob' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Bob');
  });

  it('returns 400 when assignee field is missing from body', async () => {
    const created = await request(app).post('/tasks').send({ title: 'My task' });
    const res = await request(app).patch(`/tasks/${created.body.id}/assign`).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/assignee/i);
  });

  it('returns 400 when assignee is an empty or whitespace-only string', async () => {
    const created = await request(app).post('/tasks').send({ title: 'My task' });
    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when assignee is not a string (e.g. a number)', async () => {
    const created = await request(app).post('/tasks').send({ title: 'My task' });
    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: 42 });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the task does not exist', async () => {
    const res = await request(app)
      .patch('/tasks/fake-id/assign')
      .send({ assignee: 'Alice' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('preserves all other task fields after assigning', async () => {
    const created = await request(app)
      .post('/tasks')
      .send({ title: 'Keep fields', priority: 'high', status: 'in_progress' });
    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: 'Alice' });
    expect(res.body.title).toBe('Keep fields');
    expect(res.body.priority).toBe('high');
    expect(res.body.status).toBe('in_progress');
  });
});
