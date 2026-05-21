const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { requirePermissions } = require('../middleware/rbac');
const { apiRateLimit } = require('../middleware/rateLimit');
const validate = require('../middleware/validate');
const { STAFF_CREATION_ROLES } = require('../utils/roles');
const { z } = require('zod');

const createSchema = z.object({
  body: z.object({
    full_name: z.string().min(5).max(200),
    email: z.string().email(),
    phone: z.string().max(30).optional().nullable(),
    role: z.enum(STAFF_CREATION_ROLES),
  }),
});

const updateMeSchema = z.object({
  body: z.object({
    full_name: z.string().min(1).max(200).optional(),
    phone: z.string().max(30).optional().nullable(),
    current_password: z.string().optional(),
    new_password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/).optional(),
  }).refine((data) => {
    if (data.new_password && !data.current_password) return false;
    return true;
  }, { message: 'current_password required when changing password' }),
});

router.use(authenticate);
router.use(apiRateLimit);

router.get('/me', userController.me);
router.patch('/me', validate(updateMeSchema), userController.updateMe);

// Director-only
router.get('/all', requirePermissions('users:manage'), userController.listAll);
router.get('/', requirePermissions('users:manage'), userController.list);
router.post('/', requirePermissions('users:manage'), validate(createSchema), userController.create);
router.patch('/:user_id/reset-password', requirePermissions('users:manage'), userController.resetPassword);
router.patch('/:user_id/make-director', requirePermissions('users:manage'), userController.makeDirector);
router.patch('/:user_id/deactivate', requirePermissions('users:manage'), userController.deactivate);

module.exports = router;
