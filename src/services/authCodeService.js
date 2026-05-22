const crypto = require('crypto');
const redis = require('../utils/redis');
const config = require('../config');

function generateCode() {
  return Array.from({ length: 6 }, () => crypto.randomInt(0, 10)).join('');
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

async function createCode({ purpose, userId, ttlMinutes }) {
  const code = generateCode();
  const key = redis.key(`auth-code:${purpose}:${userId}`);
  await redis.setex(key, ttlMinutes * 60, hashCode(code));
  return code;
}

async function verifyCode({ purpose, userId, code }) {
  const key = redis.key(`auth-code:${purpose}:${userId}`);
  const expectedHash = await redis.get(key);
  if (!expectedHash || expectedHash !== hashCode(code)) {
    const err = new Error('Invalid or expired code');
    err.statusCode = 422;
    err.code = 'validation_error';
    throw err;
  }
  await redis.del(key);
}

async function createEmailVerificationCode(userId) {
  return createCode({
    purpose: 'email-verification',
    userId,
    ttlMinutes: config.emailVerificationTtlMinutes,
  });
}

async function verifyEmailVerificationCode(userId, code) {
  return verifyCode({
    purpose: 'email-verification',
    userId,
    code,
  });
}

async function createPasswordResetCode(userId) {
  return createCode({
    purpose: 'password-reset',
    userId,
    ttlMinutes: config.passwordResetTtlMinutes,
  });
}

async function verifyPasswordResetCode(userId, code) {
  return verifyCode({
    purpose: 'password-reset',
    userId,
    code,
  });
}

module.exports = {
  createEmailVerificationCode,
  verifyEmailVerificationCode,
  createPasswordResetCode,
  verifyPasswordResetCode,
};
