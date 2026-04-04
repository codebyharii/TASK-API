const { v4: uuidv4 } = require('uuid');

let tasks = [];

const getAll = () => [...tasks];

const findById = (id) => tasks.find((t) => t.id === id);

/**
 * BUG 1 FIX: Original code used t.status.includes(status) which does substring matching.
 * e.g. getByStatus('in') would incorrectly match tasks with status 'in_progress'.
 * Fixed to use strict equality (===) for exact status matching.
 */
const getByStatus = (status) => tasks.filter((t) => t.status === status);

/**
 * BUG 2 FIX: Original code used offset = page * limit which skips page 1 entirely.
 * e.g. page=1, limit=10 → offset=10, returning items 11-20 instead of 1-10.
 * Fixed to use (page - 1) * limit so page 1 correctly starts at index 0.
 */
const getPaginated = (page, limit) => {
  const offset = (page - 1) * limit;
  return tasks.slice(offset, offset + limit);
};

const getStats = () => {
  const now = new Date();
  const counts = { todo: 0, in_progress: 0, done: 0 };
  let overdue = 0;
  tasks.forEach((t) => {
    if (counts[t.status] !== undefined) counts[t.status]++;
    // A task is overdue if it has a dueDate, is not done, and dueDate is in the past
    if (t.dueDate && t.status !== 'done' && new Date(t.dueDate) < now) {
      overdue++;
    }
  });
  return { ...counts, overdue };
};

const create = ({ title, description = '', status = 'todo', priority = 'medium', dueDate = null }) => {
  const task = {
    id: uuidv4(),
    title,
    description,
    status,
    priority,
    dueDate,
    assignee: null,       // null until assigned via PATCH /tasks/:id/assign
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
  tasks.push(task);
  return task;
};

const update = (id, fields) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;
  const updated = { ...tasks[index], ...fields };
  tasks[index] = updated;
  return updated;
};

const remove = (id) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return false;
  tasks.splice(index, 1);
  return true;
};

/**
 * BUG 3 FIX: Original code hardcoded priority: 'medium' when completing a task.
 * This silently downgraded high-priority tasks to medium upon completion.
 * Fixed by removing the priority override — only status and completedAt should change.
 */
const completeTask = (id) => {
  const task = findById(id);
  if (!task) return null;
  const updated = {
    ...task,
    status: 'done',
    completedAt: new Date().toISOString(),
  };
  const index = tasks.findIndex((t) => t.id === id);
  tasks[index] = updated;
  return updated;
};

/**
 * NEW FEATURE: Assign a task to a person by name.
 * Design decisions:
 *  - assignee is a free-form string (name), not a user ID — kept simple per the brief.
 *  - Reassigning is allowed (overwrites existing assignee). No conflict/error returned.
 *  - Validation (non-empty string) is handled at the route level before this is called.
 */
const assignTask = (id, assignee) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;
  tasks[index] = { ...tasks[index], assignee };
  return tasks[index];
};

// Test helper — resets in-memory store between tests
const _reset = () => {
  tasks = [];
};

module.exports = {
  getAll,
  findById,
  getByStatus,
  getPaginated,
  getStats,
  create,
  update,
  remove,
  completeTask,
  assignTask,
  _reset,
};
