const prisma = require('../utils/prisma');
const { writeAuditLog } = require('../utils/audit');
const {
  isManagementRole,
  isLegalWorkRole,
  isAssignableCaseRole,
  roleHasPermission,
} = require('../utils/roles');

function groupAccessWhere(userId) {
  return {
    groups: {
      some: {
        group: {
          members: {
            some: { user_id: userId },
          },
        },
      },
    },
  };
}

async function canReadCaseByGroup(caseId, userId) {
  const count = await prisma.case.count({
    where: {
      id: caseId,
      ...groupAccessWhere(userId),
    },
  });

  return count > 0;
}

async function listCases({ cursor, limit, status, lawyerId }, currentUser) {
  const take = Math.min(limit || 20, 100);
  const where = {};

  if (status) where.status = status;

  if (isLegalWorkRole(currentUser.role)) {
    where.lawyer_id = currentUser.id;
  } else if (isManagementRole(currentUser.role) && lawyerId) {
    where.lawyer_id = lawyerId;
  } else if (roleHasPermission(currentUser.role, 'cases:read_group')) {
    Object.assign(where, groupAccessWhere(currentUser.id));
  } else if (!isManagementRole(currentUser.role)) {
    const err = new Error('У вас нет доступа к списку дел');
    err.statusCode = 403;
    err.code = 'forbidden';
    throw err;
  }

  const items = await prisma.case.findMany({
    where,
    take: take + 1,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { last_activity_at: 'desc' },
    include: {
      inquiry: {
        select: { id: true, full_name: true, category: true, status: true, created_at: true },
      },
      lawyer: {
        select: { id: true, full_name: true, role: true, email: true, is_active: true },
      },
      _count: { select: { tasks: true } },
    },
  });

  let nextCursor = null;
  if (items.length > take) {
    const nextItem = items.pop();
    nextCursor = nextItem.id;
  }

  return {
    items: items.map(c => ({
      id: c.id,
      inquiry: c.inquiry,
      lawyer: c.lawyer,
      status: c.status,
      created_at: c.created_at,
      last_activity_at: c.last_activity_at,
      completed_at: c.completed_at,
      open_tasks_count: c._count.tasks,
      total_tasks_count: c._count.tasks,
    })),
    pagination: {
      total_returned: items.length,
      limit: take,
      next_cursor: nextCursor,
    },
  };
}

async function getCaseDetail(caseId, currentUser) {
  const c = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      inquiry: true,
      lawyer: {
        select: { id: true, full_name: true, email: true, role: true, is_active: true, phone: true },
      },
      assignedBy: {
        select: { id: true, full_name: true },
      },
      tasks: { orderBy: { created_at: 'desc' } },
      documents: { orderBy: { created_at: 'desc' } },
      notes: {
        orderBy: { created_at: 'desc' },
        include: { author: { select: { id: true, full_name: true, role: true } } },
      },
      history: {
        orderBy: { changed_at: 'desc' },
        include: {
          oldLawyer: { select: { id: true, full_name: true } },
          newLawyer: { select: { id: true, full_name: true } },
          changedBy: { select: { id: true, full_name: true } },
        },
      },
    },
  });

  if (!c) {
    const err = new Error('Дело не найдено');
    err.statusCode = 404;
    err.code = 'not_found';
    throw err;
  }

  if (isLegalWorkRole(currentUser.role) && c.lawyer_id !== currentUser.id) {
    const err = new Error('У вас нет доступа к этому ресурсу');
    err.statusCode = 403;
    err.code = 'forbidden';
    throw err;
  }

  if (roleHasPermission(currentUser.role, 'cases:read_group') && await canReadCaseByGroup(caseId, currentUser.id)) {
    return c;
  }

  if (!isManagementRole(currentUser.role) && !isLegalWorkRole(currentUser.role)) {
    const err = new Error('У вас нет доступа к этому ресурсу');
    err.statusCode = 403;
    err.code = 'forbidden';
    throw err;
  }

  return c;
}

async function updateStatus(caseId, newStatus, currentUser) {
  const c = await prisma.case.findUnique({
    where: { id: caseId },
    include: { tasks: true },
  });

  if (!c) {
    const err = new Error('Дело не найдено');
    err.statusCode = 404;
    err.code = 'not_found';
    throw err;
  }

  if (isLegalWorkRole(currentUser.role) && c.lawyer_id !== currentUser.id) {
    const err = new Error('У вас нет доступа к этому ресурсу');
    err.statusCode = 403;
    err.code = 'forbidden';
    throw err;
  }

  if (!isManagementRole(currentUser.role) && !isLegalWorkRole(currentUser.role)) {
    const err = new Error('У вас нет доступа к этому ресурсу');
    err.statusCode = 403;
    err.code = 'forbidden';
    throw err;
  }

  if (c.status === 'archived') {
    const err = new Error('Архивированное дело нельзя изменить');
    err.statusCode = 409;
    err.code = 'conflict';
    throw err;
  }

  // State machine rules
  if (newStatus === 'ready_for_review') {
    if (!isLegalWorkRole(currentUser.role)) {
      const err = new Error('Только юрист может отправить на проверку');
      err.statusCode = 403;
      err.code = 'forbidden';
      throw err;
    }
    const openTasks = c.tasks.filter(t => t.status !== 'done');
    if (openTasks.length > 0) {
      const err = new Error(`Нельзя завершить: есть ${openTasks.length} незакрытые задачи.`);
      err.statusCode = 409;
      err.code = 'conflict';
      err.detail = { open_tasks: openTasks.map(t => t.id) };
      throw err;
    }
  }

  if (['completed', 'active'].includes(newStatus) && !isManagementRole(currentUser.role)) {
    const err = new Error('Только директор может изменить этот статус');
    err.statusCode = 403;
    err.code = 'forbidden';
    throw err;
  }

  const updateData = { status: newStatus, last_activity_at: new Date() };
  if (newStatus === 'completed') updateData.completed_at = new Date();

  const updated = await prisma.case.update({
    where: { id: caseId },
    data: updateData,
    include: {
      inquiry: { select: { id: true, full_name: true, category: true, status: true } },
      lawyer: { select: { id: true, full_name: true, email: true, role: true, is_active: true } },
    },
  });

  const actionMap = {
    ready_for_review: 'case_ready',
    completed: 'case_completed',
    active: 'case_ready', // returning to active
    archived: 'case_archived',
  };

  await writeAuditLog({
    userId: currentUser.id,
    action: actionMap[newStatus] || 'case_ready',
    resourceType: 'case',
    resourceId: caseId,
    metadata: { old_status: c.status, new_status: newStatus },
  });

  return updated;
}

async function reassignLawyer(caseId, newLawyerId, reason, changedById) {
  const result = await prisma.$transaction(async (tx) => {
    const c = await tx.case.findUnique({
      where: { id: caseId },
      include: { inquiry: true },
    });

    if (!c) {
      const err = new Error('Дело не найдено');
      err.statusCode = 404;
      err.code = 'not_found';
      throw err;
    }

    if (c.status === 'archived') {
      const err = new Error('Нельзя переназначить архивированное дело');
      err.statusCode = 409;
      err.code = 'conflict';
      throw err;
    }

    if (!['active', 'ready_for_review'].includes(c.status)) {
      const err = new Error('Нельзя переназначить дело в текущем статусе');
      err.statusCode = 409;
      err.code = 'conflict';
      throw err;
    }

    const newLawyer = await tx.user.findUnique({ where: { id: newLawyerId } });
    if (!newLawyer || !newLawyer.is_active || !isAssignableCaseRole(newLawyer.role)) {
      const err = new Error('Юрист не найден или деактивирован');
      err.statusCode = 422;
      err.code = 'validation_error';
      throw err;
    }

    await tx.caseHistory.create({
      data: {
        case_id: caseId,
        old_lawyer_id: c.lawyer_id,
        new_lawyer_id: newLawyerId,
        changed_by: changedById,
        reason: reason || null,
      },
    });

    const updated = await tx.case.update({
      where: { id: caseId },
      data: {
        lawyer_id: newLawyerId,
        last_activity_at: new Date(),
      },
      include: {
        inquiry: { select: { id: true, full_name: true, category: true, status: true } },
        lawyer: { select: { id: true, full_name: true, email: true, role: true, is_active: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        user_id: changedById,
        action: 'case_reassigned',
        resource_type: 'case',
        resource_id: caseId,
        metadata: { old_lawyer_id: c.lawyer_id, new_lawyer_id: newLawyerId, reason: reason || null },
      },
    });

    return updated;
  }, {
    isolationLevel: 'Serializable',
  });

  return result;
}

module.exports = {
  listCases,
  getCaseDetail,
  updateStatus,
  reassignLawyer,
};
