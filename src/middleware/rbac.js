const { roleHasPermission } = require('../utils/roles');
const prisma = require('../utils/prisma');

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      const err = new Error('Требуется авторизация');
      err.statusCode = 401;
      err.code = 'unauthorized';
      return next(err);
    }

    if (!allowedRoles.includes(req.user.role)) {
      const err = new Error('У вас нет доступа к этому ресурсу');
      err.statusCode = 403;
      err.code = 'forbidden';
      return next(err);
    }

    next();
  };
}

function requirePermissions(...permissions) {
  return async (req, res, next) => {
    if (!req.user) {
      const err = new Error('Требуется авторизация');
      err.statusCode = 401;
      err.code = 'unauthorized';
      return next(err);
    }

    try {
      const granted = await prisma.rolePermission.findMany({
        where: {
          role: req.user.role,
          permission: { in: permissions },
        },
        select: { permission: true },
      });
      const grantedSet = new Set(granted.map(item => item.permission));
      const allowed = permissions.every(permission => grantedSet.has(permission));

      if (!allowed) {
        const err = new Error('У вас нет доступа к этому ресурсу');
        err.statusCode = 403;
        err.code = 'forbidden';
        return next(err);
      }

      return next();
    } catch (err) {
      const allowedByFallback = permissions.every(permission => roleHasPermission(req.user.role, permission));
      if (allowedByFallback) return next();

      return next(err);
    }
  };
}

module.exports = { requireRoles, requirePermissions };
