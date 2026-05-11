const crypto = require('crypto');
const bcrypt = require('bcrypt');
const prisma = require('../utils/prisma');
const redis = require('../utils/redis');
const config = require('../config');
const emailService = require('./emailService');

function generateCode() {
  return Array.from({ length: config.otpLength }, () =>
    crypto.randomInt(0, 10)
  ).join('');
}

async function createOTP(inquiryId) {
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + config.otpTtlMinutes * 60 * 1000);

  await prisma.inquiryOTP.upsert({
    where: { inquiry_id: inquiryId },
    update: {
      code_hash: codeHash,
      expires_at: expiresAt,
      attempts: 0,
    },
    create: {
      inquiry_id: inquiryId,
      code_hash: codeHash,
      expires_at: expiresAt,
      attempts: 0,
    },
  });

  return code;
}

async function verifyOTP(inquiryId, code) {
  const otpRecord = await prisma.inquiryOTP.findUnique({
    where: { inquiry_id: inquiryId },
    include: { inquiry: true },
  });

  if (!otpRecord) {
    const err = new Error('OTP не найден');
    err.statusCode = 410;
    err.code = 'code_expired';
    throw err;
  }

  if (new Date() > otpRecord.expires_at) {
    await prisma.inquiryOTP.delete({ where: { id: otpRecord.id } });
    await prisma.clientInquiry.update({
      where: { id: inquiryId },
      data: { status: 'cancelled' },
    });
    const err = new Error('Код подтверждения истёк. Заполните форму заново.');
    err.statusCode = 410;
    err.code = 'code_expired';
    throw err;
  }

  const newAttempts = otpRecord.attempts + 1;
  await prisma.inquiryOTP.update({
    where: { id: otpRecord.id },
    data: { attempts: newAttempts },
  });

  if (newAttempts > config.otpMaxAttempts) {
    await prisma.inquiryOTP.delete({ where: { id: otpRecord.id } });
    await prisma.clientInquiry.update({
      where: { id: inquiryId },
      data: { status: 'cancelled' },
    });
    const err = new Error('Превышено количество попыток. Заявка отменена. Заполните форму заново.');
    err.statusCode = 429;
    err.code = 'attempts_exhausted';
    throw err;
  }

  const valid = await bcrypt.compare(code, otpRecord.code_hash);
  if (!valid) {
    const remaining = config.otpMaxAttempts - newAttempts;
    const err = new Error(`Неверный код. Осталось попыток: ${remaining}`);
    err.statusCode = 400;
    err.code = 'invalid_code';
    err.detail = { attempts_remaining: remaining };
    throw err;
  }

  // Atomic transaction: update inquiry + delete OTP
  const result = await prisma.$transaction(async (tx) => {
    const inquiry = await tx.clientInquiry.update({
      where: { id: inquiryId },
      data: {
        status: 'new',
        email_verified_at: new Date(),
      },
    });
    await tx.inquiryOTP.delete({ where: { id: otpRecord.id } });
    return inquiry;
  }, {
    isolationLevel: 'Serializable',
  });

  return result;
}

async function resendOTP(inquiryId) {
  const cooldownKey = `otp:resend:${inquiryId}`;
  const exists = await redis.get(cooldownKey);
  if (exists) {
    const ttl = await redis.ttl(cooldownKey);
    const err = new Error(`Повторная отправка доступна через ${ttl} секунд.`);
    err.statusCode = 429;
    err.code = 'resend_cooldown';
    err.detail = { retry_after_seconds: ttl };
    throw err;
  }

  const inquiry = await prisma.clientInquiry.findUnique({
    where: { id: inquiryId },
  });

  if (!inquiry || inquiry.status !== 'pending_verification') {
    const err = new Error('Заявка не в статусе ожидания верификации');
    err.statusCode = 400;
    err.code = 'bad_request';
    throw err;
  }

  const code = await createOTP(inquiryId);
  await emailService.sendOTPEmail(inquiry.email, code);
  await redis.setex(cooldownKey, config.otpResendCooldownSeconds, '1');

  return inquiry;
}

module.exports = {
  createOTP,
  verifyOTP,
  resendOTP,
  generateCode,
};
