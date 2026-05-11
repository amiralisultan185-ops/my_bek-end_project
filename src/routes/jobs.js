const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const { authenticate } = require('../middleware/auth');
const { requirePermissions } = require('../middleware/rbac');
const { apiRateLimit } = require('../middleware/rateLimit');

router.use(authenticate);
router.use(apiRateLimit);
router.use(requirePermissions('users:manage'));

router.get('/email', jobController.listEmailJobs);
router.get('/email/:job_id', jobController.getEmailJob);

module.exports = router;
