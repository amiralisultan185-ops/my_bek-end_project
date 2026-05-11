const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { authenticate } = require('../middleware/auth');
const { requirePermissions } = require('../middleware/rbac');
const { apiRateLimit } = require('../middleware/rateLimit');
const validate = require('../middleware/validate');
const { z } = require('zod');

const groupTypes = ['legal_area', 'branch', 'client_segment', 'review', 'custom'];

const createSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(120),
    slug: z.string().min(2).max(120).optional(),
    type: z.enum(groupTypes).optional(),
    description: z.string().max(500).optional().nullable(),
  }),
});

const memberSchema = z.object({
  body: z.object({
    user_id: z.string().uuid(),
  }),
});

const caseSchema = z.object({
  body: z.object({
    case_id: z.string().uuid(),
  }),
});

router.use(authenticate);
router.use(apiRateLimit);
router.use(requirePermissions('groups:manage'));

router.get('/', groupController.list);
router.post('/', validate(createSchema), groupController.create);
router.post('/:group_id/members', validate(memberSchema), groupController.addMember);
router.post('/:group_id/cases', validate(caseSchema), groupController.addCase);

module.exports = router;
