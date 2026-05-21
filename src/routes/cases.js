const express = require('express');
const router = express.Router();
const caseController = require('../controllers/caseController');
const { authenticate } = require('../middleware/auth');
const { requirePermissions } = require('../middleware/rbac');
const { apiRateLimit } = require('../middleware/rateLimit');
const validate = require('../middleware/validate');
const { z } = require('zod');
const config = require('../config');

const statusSchema = z.object({
  body: z.object({
    status: z.enum(['ready_for_review', 'completed', 'active']),
  }),
});

const reassignSchema = z.object({
  body: z.object({
    lawyer_id: z.string().uuid(),
    reason: z.string().max(500).optional().nullable(),
  }),
});

const paginationSchema = z.object({
  query: z.object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

const taskListSchema = z.object({
  query: z.object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    status: z.enum(['todo', 'in_progress', 'done']).optional(),
  }),
});

const taskCreateSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(300),
    description: z.string().max(2000).optional().nullable(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    due_date: z.coerce.date().optional().nullable(),
  }),
});

const taskUpdateSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(300).optional(),
    description: z.string().max(2000).optional().nullable(),
    status: z.enum(['todo', 'in_progress', 'done']).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    due_date: z.coerce.date().optional().nullable(),
  }),
});

const noteCreateSchema = z.object({
  body: z.object({
    body: z.string().min(1).max(5000),
  }),
});

router.use(authenticate);
router.use(apiRateLimit);

router.get('/', caseController.list);
router.get('/:case_id', caseController.detail);
router.patch('/:case_id/status', validate(statusSchema), caseController.updateStatus);
router.patch('/:case_id/reassign', requirePermissions('cases:reassign'), validate(reassignSchema), caseController.reassign);
router.get('/:case_id/tasks', validate(taskListSchema), caseController.listTasks);
router.post('/:case_id/tasks', validate(taskCreateSchema), caseController.createTask);
router.patch('/:case_id/tasks/:task_id', validate(taskUpdateSchema), caseController.updateTask);
router.delete('/:case_id/tasks/:task_id', caseController.deleteTask);
router.get('/:case_id/documents', validate(paginationSchema), caseController.listDocuments);
router.post(
  '/:case_id/documents',
  express.raw({ type: '*/*', limit: config.documentMaxUploadBytes }),
  caseController.createDocument
);
router.get('/:case_id/documents/:document_id/download', caseController.downloadDocument);
router.get('/:case_id/notes', validate(paginationSchema), caseController.listNotes);
router.post('/:case_id/notes', validate(noteCreateSchema), caseController.createNote);

module.exports = router;
