const prisma = require('../utils/prisma');
const { hashPassword, generateTempPassword, verifyPassword } = require('../utils/password');
const { writeAuditLog } = require('../utils/audit');
const emailService = require('./emailService');
const {
  LEGAL_WORK_ROLES,
  STAFF_CREATION_ROLES,
  isManagementRole,
  isAssignableCaseRole,
} = require('../utils/roles');

async function createUser(data, currentUser) {
  const tempPassword = generateTempPassword();
  const hashed = await hashPassword(tempPassword);
  const role = data.role || 'lawyer';

  if (!STAFF_CREATION_ROLES.includes(role)) {
    const err = new Error('Эту роль нельзя создать через /users');
    err.statusCode = 422;
    err.code = 'validation_error';
    throw err;
  }

  if (role === 'owner') {
    const ownerCount = await prisma.user.count({
      where: {
        role: 'owner',
        is_active: true,
      },
    });

    if (ownerCount > 0 && currentUser.role !== 'owner') {
      const err = new Error('Только owner может создавать дополнительных owner');
      err.statusCode = 403;
      err.code = 'forbidden';
      throw err;
    }
  }

  const user = await prisma.user.create({
    data: {
      email: data.email,
      full_name: data.full_name,
      hashed_password: hashed,
      role,
      is_active: true,
      must_change_password: true,
      email_verified_at: null,
      phone: data.phone || null,
    },
    select: {
      id: true, email: true, full_name: true, role: true, is_active: true, phone: true, created_at: true,
    },
  });

  await writeAuditLog({
    userId: currentUser.id,
    action: 'user_created',
    resourceType: 'user',
    resourceId: user.id,
    metadata: { email: user.email, role },
  });

  // Email temp password (mock in dev)
  emailService.sendEmail({
    to: user.email,
    subject: 'Ваш временный пароль — POWER LAW Digital',
    text: `Ваш временный пароль: ${tempPassword}. Смените его при первом входе.`,
  }).catch(() => {});

  const authCodeService = require('./authCodeService');
  const code = await authCodeService.createEmailVerificationCode(user.id);
  emailService.sendUserVerificationEmail(user.email, code).catch(() => {});

  return { user, temp_password: tempPassword };
}

async function deactivateLawyer(userId, changedById) {
  const activeCases = await prisma.case.count({
    where: {
      lawyer_id: userId,
      status: { in: ['active', 'ready_for_review'] },
    },
  });

  if (activeCases > 0) {
    const err = new Error(`У юриста ${activeCases} активных дела. Переназначьте их перед деактивацией.`);
    err.statusCode = 409;
    err.code = 'conflict';
    throw err;
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { is_active: false },
    select: {
      id: true, email: true, full_name: true, role: true, is_active: true, phone: true, created_at: true,
    },
  });

  await writeAuditLog({
    userId: changedById,
    action: 'user_deactivated',
    resourceType: 'user',
    resourceId: userId,
  });

  return user;
}

async function makeDirector(userId, currentDirectorId) {
  if (userId === currentDirectorId) {
    const err = new Error('Пользователь уже является директором');
    err.statusCode = 409;
    err.code = 'conflict';
    throw err;
  }

  const result = await prisma.$transaction(async (tx) => {
    const newDirector = await tx.user.findUnique({
      where: { id: userId },
    });

    if (!newDirector || !newDirector.is_active || !isAssignableCaseRole(newDirector.role)) {
      const err = new Error('Активный юрист не найден');
      err.statusCode = 422;
      err.code = 'validation_error';
      throw err;
    }

    const activeCases = await tx.case.count({
      where: {
        lawyer_id: userId,
        status: { in: ['active', 'ready_for_review'] },
      },
    });

    if (activeCases > 0) {
      const err = new Error(`У юриста ${activeCases} активных дела. Переназначьте их перед назначением директором.`);
      err.statusCode = 409;
      err.code = 'conflict';
      throw err;
    }

    const currentDirector = await tx.user.findUnique({
      where: { id: currentDirectorId },
    });

    if (!currentDirector || !currentDirector.is_active || !isManagementRole(currentDirector.role)) {
      const err = new Error('Текущий директор не найден или уже не активен');
      err.statusCode = 403;
      err.code = 'forbidden';
      throw err;
    }

    await tx.user.updateMany({
      where: {
        role: 'director',
        is_active: true,
      },
      data: { role: 'senior_lawyer' },
    });

    const updatedDirector = await tx.user.update({
      where: { id: userId },
      data: { role: 'director' },
      select: {
        id: true, email: true, full_name: true, role: true, is_active: true, phone: true, created_at: true,
      },
    });

    await tx.auditLog.create({
      data: {
        user_id: currentDirectorId,
        action: 'user_role_changed',
        resource_type: 'user',
        resource_id: userId,
        metadata: {
          event: 'director_changed',
          old_director_id: currentDirectorId,
          new_director_id: userId,
          previous_directors_new_role: 'senior_lawyer',
        },
      },
    });

    return updatedDirector;
  }, {
    isolationLevel: 'Serializable',
  });

  return result;
}

async function getWorkloadDashboard() {
  const lawyers = await prisma.user.findMany({
    where: { role: { in: LEGAL_WORK_ROLES }, is_active: true },
    select: {
      id: true, full_name: true, email: true, phone: true,
      assigned_cases: {
        select: {
          id: true, status: true, created_at: true, completed_at: true, last_activity_at: true,
        },
      },
    },
  });

  return lawyers.map(l => {
    const cases = l.assigned_cases;
    const activeCases = cases.filter(c => c.status === 'active').length;
    const pendingReview = cases.filter(c => c.status === 'ready_for_review').length;
    const completedCases = cases.filter(c => c.status === 'completed').length;
    const completedWithDate = cases.filter(c => c.completed_at);
    const avgDays = completedWithDate.length > 0
      ? Math.round(
          completedWithDate.reduce((sum, c) => {
            const days = (c.completed_at - c.created_at) / (1000 * 60 * 60 * 24);
            return sum + days;
          }, 0) / completedWithDate.length * 10
        ) / 10
      : null;

    return {
      lawyer: {
        id: l.id,
        full_name: l.full_name,
        role: l.role,
        email: l.email,
        phone: l.phone,
        is_active: true,
      },
      active_cases: activeCases,
      pending_review: pendingReview,
      completed_cases: completedCases,
      total_cases: cases.length,
      avg_days_to_complete: avgDays,
      last_case_activity: cases.length > 0
        ? cases.reduce((max, c) => (c.last_activity_at > max ? c.last_activity_at : max), cases[0].last_activity_at)
        : null,
    };
  }).sort((a, b) => {
    if (a.active_cases !== b.active_cases) return a.active_cases - b.active_cases;
    const aDate = a.last_case_activity || new Date(0);
    const bDate = b.last_case_activity || new Date(0);
    return bDate - aDate;
  });
}

async function listAllUsers({ cursor, limit = 50, role, q } = {}) {
  const take = Math.min(Number(limit) || 50, 100);
  const where = {};

  if (role) where.role = role;
  if (q) {
    where.OR = [
      { full_name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ];
  }

  const items = await prisma.user.findMany({
    where,
    take: take + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    orderBy: [
      { role: 'asc' },
      { full_name: 'asc' },
    ],
    select: {
      id: true,
      email: true,
      full_name: true,
      role: true,
      is_active: true,
      must_change_password: true,
      phone: true,
      created_at: true,
      updated_at: true,
      group_memberships: {
        select: {
          group: {
            select: {
              id: true,
              name: true,
              slug: true,
              type: true,
            },
          },
        },
      },
    },
  });

  let nextCursor = null;
  if (items.length > take) {
    const nextItem = items.pop();
    nextCursor = nextItem.id;
  }

  return {
    items,
    pagination: {
      total_returned: items.length,
      limit: take,
      next_cursor: nextCursor,
    },
  };
}

async function resetUserPassword(userId, changedById) {
  const tempPassword = generateTempPassword();
  const hashed = await hashPassword(tempPassword);

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      hashed_password: hashed,
      must_change_password: true,
    },
    select: {
      id: true,
      email: true,
      full_name: true,
      role: true,
      is_active: true,
      must_change_password: true,
      phone: true,
      created_at: true,
    },
  });

  await writeAuditLog({
    userId: changedById,
    action: 'user_role_changed',
    resourceType: 'user',
    resourceId: userId,
    metadata: { event: 'password_reset' },
  });

  emailService.sendEmail({
    to: user.email,
    subject: 'Новый временный пароль — POWER LAW Digital',
    text: `Ваш новый временный пароль: ${tempPassword}. Смените его при следующем входе.`,
  }).catch(() => {});

  return { user, temp_password: tempPassword };
}

async function updateProfile(userId, data) {
  const updateData = {};
  if (data.full_name !== undefined) updateData.full_name = data.full_name;
  if (data.phone !== undefined) updateData.phone = data.phone;

  if (data.new_password) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { hashed_password: true },
    });

    if (!user) {
      const err = new Error('Пользователь не найден');
      err.statusCode = 404;
      err.code = 'not_found';
      throw err;
    }

    const valid = await verifyPassword(data.current_password, user.hashed_password);
    if (!valid) {
      const err = new Error('Неверный текущий пароль');
      err.statusCode = 401;
      err.code = 'unauthorized';
      throw err;
    }

    updateData.hashed_password = await hashPassword(data.new_password);
    updateData.must_change_password = false;
  }

  return prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true, email: true, full_name: true, role: true, is_active: true, phone: true, created_at: true,
    },
  });
}

module.exports = {
  createUser,
  deactivateLawyer,
  makeDirector,
  getWorkloadDashboard,
  listAllUsers,
  resetUserPassword,
  updateProfile,
};
