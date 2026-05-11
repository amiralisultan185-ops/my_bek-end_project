const { verifyToken } = require('../utils/jwt');
const prisma = require('../utils/prisma');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const err = new Error('Требуется авторизация');
      err.statusCode = 401;
      err.code = 'unauthorized';
      throw err;
    }

    const token = authHeader.slice(7);
    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, full_name: true, role: true, is_active: true, must_change_password: true, email_verified_at: true, phone: true },
    });

    if (!user) {
      const err = new Error('Пользователь не найден');
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

    req.user = user;

    if (!user.email_verified_at) {
      const err = new Error('Email is not verified');
      err.statusCode = 403;
      err.code = 'email_not_verified';
      throw err;
    }

    const passwordChangeAllowed =
      req.baseUrl === '/users' &&
      req.path === '/me' &&
      ['GET', 'PATCH'].includes(req.method);

    if (user.must_change_password && !passwordChangeAllowed) {
      const err = new Error('Необходимо сменить временный пароль');
      err.statusCode = 403;
      err.code = 'password_change_required';
      throw err;
    }

    next();
  } catch (err) {
    next(err);
  }
}

async function optionalAuthenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.slice(7);
    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, full_name: true, role: true, is_active: true, must_change_password: true, email_verified_at: true, phone: true },
    });

    if (user && user.is_active && user.email_verified_at) {
      req.user = user;
    }

    return next();
  } catch {
    return next();
  }
}

module.exports = { authenticate, optionalAuthenticate };
