const prisma = require('../utils/prisma');
const { hashPassword, verifyPassword, generateTempPassword } = require('../utils/password');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { writeAuditLog } = require('../utils/audit');
const { getClientIp } = require('../middleware/rateLimit');
const emailService = require('./emailService');
const authCodeService = require('./authCodeService');
const config = require('../config');

async function registerDirector(data) {
  const existingDirector = await prisma.user.findFirst({
    where: {
      role: { in: ['owner', 'director'] },
    },
  });

  if (existingDirector) {
    const err = new Error('Директор уже существует. Используйте создание юристов через /users');
    err.statusCode = 403;
    err.code = 'forbidden';
    throw err;
  }

  const hashed = await hashPassword(data.password);
  const user = await prisma.user.create({
    data: {
      email: data.email,
      full_name: data.full_name,
      hashed_password: hashed,
      role: 'director',
      is_active: true,
      must_change_password: false,
      email_verified_at: null,
      phone: data.phone || null,
    },
    select: {
      id: true, email: true, full_name: true, role: true, is_active: true, phone: true, created_at: true,
    },
  });

  const code = await authCodeService.createEmailVerificationCode(user.id);
  await emailService.sendUserVerificationEmail(user.email, code);

  return user;
}

async function registerClient(data) {
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    const err = new Error('Пользователь с таким email уже существует');
    err.statusCode = 409;
    err.code = 'conflict';
    throw err;
  }

  const hashed = await hashPassword(data.password);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: data.email,
        full_name: data.full_name,
        hashed_password: hashed,
        role: 'client',
        is_active: true,
        must_change_password: false,
        email_verified_at: null,
        phone: data.phone || null,
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        is_active: true,
        phone: true,
        created_at: true,
      },
    });

    const linked = await tx.clientInquiry.updateMany({
      where: {
        email: data.email,
        email_verified_at: { not: null },
        client_user_id: null,
      },
      data: {
        client_user_id: user.id,
      },
    });

    return { user, linked_inquiries_count: linked.count };
  });

  const code = await authCodeService.createEmailVerificationCode(result.user.id);
  await emailService.sendUserVerificationEmail(result.user.email, code);

  return result;
}

async function verifyEmail(data) {
  const user = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (!user) {
    const err = new Error('Пользователь не найден');
    err.statusCode = 404;
    err.code = 'not_found';
    throw err;
  }

  await authCodeService.verifyEmailVerificationCode(user.id, data.code);

  return prisma.user.update({
    where: { id: user.id },
    data: { email_verified_at: new Date() },
    select: {
      id: true, email: true, full_name: true, role: true, is_active: true, email_verified_at: true,
    },
  });
}

async function resendEmailVerification(data) {
  const user = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (!user) {
    const err = new Error('Пользователь не найден');
    err.statusCode = 404;
    err.code = 'not_found';
    throw err;
  }

  if (user.email_verified_at) {
    return { already_verified: true };
  }

  const code = await authCodeService.createEmailVerificationCode(user.id);
  await emailService.sendUserVerificationEmail(user.email, code);
  return { already_verified: false };
}

async function requestPasswordReset(data) {
  const user = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (!user || !user.is_active) {
    return { message: 'If the email exists, a reset code has been sent.' };
  }

  const code = await authCodeService.createPasswordResetCode(user.id);
  await emailService.sendPasswordResetEmail(user.email, code);
  return { message: 'If the email exists, a reset code has been sent.' };
}

async function resetPasswordWithCode(data) {
  const user = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (!user || !user.is_active) {
    const err = new Error('Invalid or expired code');
    err.statusCode = 422;
    err.code = 'validation_error';
    throw err;
  }

  await authCodeService.verifyPasswordResetCode(user.id, data.code);

  const hashed = await hashPassword(data.new_password);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      hashed_password: hashed,
      must_change_password: false,
    },
  });
}

async function login(data, req) {
  const user = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (!user) {
    await writeAuditLog({
      action: 'login_failed',
      resourceType: 'user',
      ipAddress: getClientIp(req),
      metadata: { email: data.email, reason: 'user_not_found' },
    });
    const err = new Error('Неверный email или пароль');
    err.statusCode = 401;
    err.code = 'unauthorized';
    throw err;
  }

  if (!user.is_active) {
    const err = new Error('Аккаунт деактивирован');
    err.statusCode = 401;
    err.code = 'unauthorized';
    throw err;
  }

  if (!user.email_verified_at) {
    const err = new Error('Email is not verified');
    err.statusCode = 403;
    err.code = 'email_not_verified';
    throw err;
  }

  const valid = await verifyPassword(data.password, user.hashed_password);
  if (!valid) {
    await writeAuditLog({
      userId: user.id,
      action: 'login_failed',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: getClientIp(req),
      metadata: { reason: 'invalid_password' },
    });
    const err = new Error('Неверный email или пароль');
    err.statusCode = 401;
    err.code = 'unauthorized';
    throw err;
  }

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  const { token: refreshToken, jti } = signRefreshToken();
  const refreshExpires = new Date(Date.now() + config.refreshTokenExpireDays * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      user_id: user.id,
      jti,
      expires_at: refreshExpires,
    },
  });

  await writeAuditLog({
    userId: user.id,
    action: 'login_success',
    resourceType: 'user',
    resourceId: user.id,
    ipAddress: getClientIp(req),
  });

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'bearer',
    expires_in: config.accessTokenExpireMinutes * 60,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      must_change_password: user.must_change_password,
    },
  };
}

async function refresh(refreshToken) {
  const decoded = verifyRefreshToken(refreshToken);

  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { jti: decoded.jti },
    include: { user: true },
  });

  if (!tokenRecord || tokenRecord.revoked_at || new Date() > tokenRecord.expires_at) {
    const err = new Error('Недействительный или просроченный refresh токен');
    err.statusCode = 401;
    err.code = 'unauthorized';
    throw err;
  }

  // Rotate: revoke old, create new
  await prisma.refreshToken.update({
    where: { id: tokenRecord.id },
    data: { revoked_at: new Date() },
  });

  const user = tokenRecord.user;
  if (!user.is_active) {
    const err = new Error('Аккаунт деактивирован');
    err.statusCode = 401;
    err.code = 'unauthorized';
    throw err;
  }

  const newAccessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  const { token: newRefreshToken, jti: newJti } = signRefreshToken();
  const refreshExpires = new Date(Date.now() + config.refreshTokenExpireDays * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      user_id: user.id,
      jti: newJti,
      expires_at: refreshExpires,
    },
  });

  return {
    access_token: newAccessToken,
    refresh_token: newRefreshToken,
    token_type: 'bearer',
    expires_in: config.accessTokenExpireMinutes * 60,
  };
}

async function logout(refreshToken) {
  try {
    const decoded = verifyRefreshToken(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { jti: decoded.jti },
      data: { revoked_at: new Date() },
    });
  } catch {
    // Ignore invalid token on logout
  }
}

module.exports = {
  registerDirector,
  registerClient,
  verifyEmail,
  resendEmailVerification,
  requestPasswordReset,
  resetPasswordWithCode,
  login,
  refresh,
  logout,
};
