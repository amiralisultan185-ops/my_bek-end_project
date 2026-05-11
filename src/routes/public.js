const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');
const { submitRateLimit } = require('../middleware/rateLimit');
const { optionalAuthenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { z } = require('zod');

const submitSchema = z.object({
  body: z.object({
    full_name: z.string().min(5).max(200),
    email: z.string().email().max(255),
    phone: z.string().max(30),
    category: z.enum(['family', 'criminal', 'corporate', 'real_estate', 'labor', 'ip', 'other']),
    description: z.string().min(50).max(3000),
    desired_timeline: z.string().max(200).optional().nullable(),
  }),
});

const verifySchema = z.object({
  body: z.object({
    inquiry_id: z.string().uuid(),
    code: z.string().regex(/^\d{6}$/),
  }),
});

const resendSchema = z.object({
  body: z.object({
    inquiry_id: z.string().uuid(),
  }),
});

router.post('/submit', submitRateLimit, optionalAuthenticate, validate(submitSchema), publicController.submit);
router.post('/submit/verify', validate(verifySchema), publicController.verify);
router.post('/submit/resend', validate(resendSchema), publicController.resend);

module.exports = router;
