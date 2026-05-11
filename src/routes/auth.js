const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { loginRateLimit } = require('../middleware/rateLimit');
const validate = require('../middleware/validate');
const { z } = require('zod');

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

const refreshSchema = z.object({
  body: z.object({
    refresh_token: z.string().min(1),
  }),
});

const emailCodeSchema = z.object({
  body: z.object({
    email: z.string().email(),
    code: z.string().regex(/^\d{6}$/),
  }),
});

const resendVerificationSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

const passwordResetRequestSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

const passwordResetConfirmSchema = z.object({
  body: z.object({
    email: z.string().email(),
    code: z.string().regex(/^\d{6}$/),
    new_password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/),
  }),
});

const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/),
    full_name: z.string().min(5).max(200),
    phone: z.string().max(30).optional(),
  }),
});

const clientRegisterSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/),
    full_name: z.string().min(5).max(200),
    phone: z.string().max(30).optional(),
  }),
});

router.post('/register', validate(registerSchema), authController.register);
router.post('/client/register', validate(clientRegisterSchema), authController.registerClient);
router.post('/verify-email', validate(emailCodeSchema), authController.verifyEmail);
router.post('/resend-verification', validate(resendVerificationSchema), authController.resendEmailVerification);
router.post('/login', loginRateLimit, validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.post('/logout', validate(refreshSchema), authController.logout);
router.post('/password/forgot', loginRateLimit, validate(passwordResetRequestSchema), authController.requestPasswordReset);
router.post('/password/reset', loginRateLimit, validate(passwordResetConfirmSchema), authController.resetPassword);

module.exports = router;
