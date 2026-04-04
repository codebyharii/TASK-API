const express = require('express');
const router = express.Router();
const taskService = require('../services/taskService');
const { validateCreateTask, validateUpdateTask } = require('../utils/validators');

// GET /tasks/stats
// Must be defined before GET /tasks/:id to avoid 'stats' being treated as an id
router.get('/stats', (req, res) => {
  const stats = taskService.getStats();
  res.json(stats);
});

// GET /tasks
// Supports optional query params:
//   ?status=todo|in_progress|done  — filter by exact status
//   ?page=1&limit=10               — paginated results (1-indexed)
router.get('/', (req, res) => {
  const { status, page, limit } = req.query;

  if (status) {
    const tasks = taskService.getByStatus(status);
    return res.json(tasks);
  }

  if (page !== undefined || limit !== undefined) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const tasks = taskService.getPaginated(pageNum, limitNum);
    return res.json(tasks);
  }

  const tasks = taskService.getAll();
  res.json(tasks);
});

// POST /tasks
// Creates a new task. title is required; all other fields are optional with defaults.
router.post('/', (req, res) => {
  const error = validateCreateTask(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  const task = taskService.create(req.body);
  res.status(201).json(task);
});

// PUT /tasks/:id
// Full update of a task. Validates any provided fields.
router.put('/:id', (req, res) => {
  const error = validateUpdateTask(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  const task = taskService.update(req.params.id, req.body);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json(task);
});

// DELETE /tasks/:id
// Removes a task. Returns 204 No Content on success.
router.delete('/:id', (req, res) => {
  const deleted = taskService.remove(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.status(204).send();
});

// PATCH /tasks/:id/complete
// Marks a task as done and records completedAt timestamp.
// Does NOT change priority (Bug 3 fix — original code reset priority to 'medium').
router.patch('/:id/complete', (req, res) => {
  const task = taskService.completeTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json(task);
});

// PATCH /tasks/:id/assign
// NEW FEATURE: Assigns a task to a person by name.
// Body: { "assignee": "string" }
// Validation:
//   - assignee must be a non-empty string (empty string → 400)
//   - assignee is trimmed before saving
//   - Reassigning an already-assigned task is allowed (overwrites)
// Returns the updated task, or 404 if the task does not exist.
router.patch('/:id/assign', (req, res) => {
  const { assignee } = req.body;

  if (!assignee || typeof assignee !== 'string' || assignee.trim() === '') {
    return res.status(400).json({ error: 'assignee must be a non-empty string' });
  }

  const task = taskService.assignTask(req.params.id, assignee.trim());
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(task);
});

module.exports = router;
