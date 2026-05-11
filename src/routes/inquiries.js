const express = require('express');
const router = express.Router();
const inquiryController = require('../controllers/inquiryController');
const { authenticate } = require('../middleware/auth');
const { requirePermissions } = require('../middleware/rbac');
const { apiRateLimit } = require('../middleware/rateLimit');
const validate = require('../middleware/validate');
const { z } = require('zod');

const assignSchema = z.object({
  body: z.object({
    lawyer_id: z.string().uuid(),
    note: z.string().max(500).optional().nullable(),
  }),
});

router.use(authenticate);
router.use(apiRateLimit);
router.use(requirePermissions('inquiries:manage'));

router.get('/', inquiryController.list);
router.get('/:inquiry_id', inquiryController.detail);
router.post('/:inquiry_id/assign', validate(assignSchema), inquiryController.assign);

module.exports = router;
