const express = require('express');
const router = express.Router();
const caseController = require('../controllers/caseController');
const { authenticate } = require('../middleware/auth');
const { requirePermissions } = require('../middleware/rbac');
const { apiRateLimit } = require('../middleware/rateLimit');
const validate = require('../middleware/validate');
const { z } = require('zod');

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

router.use(authenticate);
router.use(apiRateLimit);

router.get('/', caseController.list);
router.get('/:case_id', caseController.detail);
router.patch('/:case_id/status', validate(statusSchema), caseController.updateStatus);
router.patch('/:case_id/reassign', requirePermissions('cases:reassign'), validate(reassignSchema), caseController.reassign);

module.exports = router;
