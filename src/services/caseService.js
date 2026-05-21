const prisma = require('../utils/prisma');
const { writeAuditLog } = require('../utils/audit');
const { encryptDocument, decryptDocument } = require('../utils/documentCrypto');
const config = require('../config');
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

function paginationResult(items, take) {
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

async function canReadCaseByGroup(caseId, userId) {
  const count = await prisma.case.count({
    where: {
      id: caseId,
      ...groupAccessWhere(userId),
    },
  });

  return count > 0;
}

async function getAccessibleCase(caseId, currentUser, { write = false } = {}) {
  const c = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      status: true,
      lawyer_id: true,
      groups: {
        select: {
          group: {
            select: {
              members: {
                where: { user_id: currentUser.id },
                select: { user_id: true },
                take: 1,
              },
            },
          },
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

  const isAssignedLawyer = isLegalWorkRole(currentUser.role) && c.lawyer_id === currentUser.id;
  const isGroupMember = c.groups.some(caseGroup => caseGroup.group.members.length > 0);
  const canReadGroup = roleHasPermission(currentUser.role, 'cases:read_group') && isGroupMember;
  const canAssistGroup = roleHasPermission(currentUser.role, 'cases:assist_group') && isGroupMember;

  const allowed = write
    ? isManagementRole(currentUser.role) || isAssignedLawyer || canAssistGroup
    : isManagementRole(currentUser.role) || isAssignedLawyer || canReadGroup;

  if (!allowed) {
    const err = new Error('У вас нет доступа к этому ресурсу');
    err.statusCode = 403;
    err.code = 'forbidden';
    throw err;
  }

  if (write && c.status === 'archived') {
    const err = new Error('Архивное дело нельзя изменить');
    err.statusCode = 409;
    err.code = 'conflict';
    throw err;
  }

  return c;
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
    skip: cursor ? 1 : 0,
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
      documents: {
        orderBy: { created_at: 'desc' },
        select: documentSelect(),
      },
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

async function listTasks(caseId, { cursor, limit, status }, currentUser) {
  await getAccessibleCase(caseId, currentUser);

  const take = Math.min(limit || 20, 100);
  const where = { case_id: caseId };
  if (status) where.status = status;

  const tasks = await prisma.task.findMany({
    where,
    take: take + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    orderBy: { created_at: 'desc' },
    include: {
      createdBy: {
        select: { id: true, full_name: true, email: true, role: true, is_active: true },
      },
    },
  });

  return paginationResult(tasks, take);
}

async function createTask(caseId, data, currentUser) {
  await getAccessibleCase(caseId, currentUser, { write: true });

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        case_id: caseId,
        created_by: currentUser.id,
        title: data.title,
        description: data.description || null,
        priority: data.priority || 'medium',
        due_date: data.due_date || null,
      },
      include: {
        createdBy: {
          select: { id: true, full_name: true, email: true, role: true, is_active: true },
        },
      },
    });

    await tx.case.update({
      where: { id: caseId },
      data: { last_activity_at: new Date() },
    });

    await tx.auditLog.create({
      data: {
        user_id: currentUser.id,
        action: 'task_created',
        resource_type: 'task',
        resource_id: created.id,
        metadata: { case_id: caseId, title: created.title },
      },
    });

    return created;
  });

  return task;
}

async function updateTask(caseId, taskId, data, currentUser) {
  await getAccessibleCase(caseId, currentUser, { write: true });

  const existing = await prisma.task.findFirst({
    where: { id: taskId, case_id: caseId },
    select: { id: true },
  });

  if (!existing) {
    const err = new Error('Задача не найдена');
    err.statusCode = 404;
    err.code = 'not_found';
    throw err;
  }

  const updateData = {};
  if (Object.prototype.hasOwnProperty.call(data, 'title')) updateData.title = data.title;
  if (Object.prototype.hasOwnProperty.call(data, 'description')) updateData.description = data.description || null;
  if (Object.prototype.hasOwnProperty.call(data, 'status')) updateData.status = data.status;
  if (Object.prototype.hasOwnProperty.call(data, 'priority')) updateData.priority = data.priority;
  if (Object.prototype.hasOwnProperty.call(data, 'due_date')) updateData.due_date = data.due_date || null;

  if (Object.keys(updateData).length === 0) {
    const err = new Error('Нет данных для обновления задачи');
    err.statusCode = 422;
    err.code = 'validation_error';
    throw err;
  }

  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        createdBy: {
          select: { id: true, full_name: true, email: true, role: true, is_active: true },
        },
      },
    });

    await tx.case.update({
      where: { id: caseId },
      data: { last_activity_at: new Date() },
    });

    await tx.auditLog.create({
      data: {
        user_id: currentUser.id,
        action: 'task_updated',
        resource_type: 'task',
        resource_id: taskId,
        metadata: { case_id: caseId },
      },
    });

    return updated;
  });

  return task;
}

async function deleteTask(caseId, taskId, currentUser) {
  await getAccessibleCase(caseId, currentUser, { write: true });

  const existing = await prisma.task.findFirst({
    where: { id: taskId, case_id: caseId },
    select: { id: true, status: true },
  });

  if (!existing) {
    const err = new Error('Задача не найдена');
    err.statusCode = 404;
    err.code = 'not_found';
    throw err;
  }

  if (existing.status !== 'todo') {
    const err = new Error('Удалить можно только задачу в статусе todo');
    err.statusCode = 409;
    err.code = 'conflict';
    throw err;
  }

  await prisma.$transaction(async (tx) => {
    await tx.task.delete({ where: { id: taskId } });

    await tx.case.update({
      where: { id: caseId },
      data: { last_activity_at: new Date() },
    });

    await tx.auditLog.create({
      data: {
        user_id: currentUser.id,
        action: 'task_deleted',
        resource_type: 'task',
        resource_id: taskId,
        metadata: { case_id: caseId },
      },
    });
  });
}

function buildStorageKey(caseId, filename) {
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return `cases/${caseId}/${Date.now()}-${safeFilename || 'document'}`;
}

function documentSelect() {
  return {
    id: true,
    case_id: true,
    uploader_id: true,
    filename: true,
    storage_key: true,
    mime_type: true,
    file_size_bytes: true,
    sha256_hash: true,
    encryption_algorithm: true,
    description: true,
    created_at: true,
    uploader: {
      select: { id: true, full_name: true, email: true, role: true, is_active: true },
    },
  };
}

function sanitizeDocument(document) {
  return {
    ...document,
    encrypted: Boolean(document.sha256_hash),
    download_url: `/cases/${document.case_id}/documents/${document.id}/download`,
  };
}

async function listDocuments(caseId, { cursor, limit }, currentUser) {
  await getAccessibleCase(caseId, currentUser);

  const take = Math.min(limit || 20, 100);
  const documents = await prisma.document.findMany({
    where: { case_id: caseId },
    take: take + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    orderBy: { created_at: 'desc' },
    select: documentSelect(),
  });

  return paginationResult(documents.map(sanitizeDocument), take);
}

async function createDocument(caseId, data, currentUser) {
  await getAccessibleCase(caseId, currentUser, { write: true });

  if (!Buffer.isBuffer(data.file_buffer) || data.file_buffer.length === 0) {
    const err = new Error('Файл не передан или пустой');
    err.statusCode = 422;
    err.code = 'validation_error';
    throw err;
  }

  if (data.file_buffer.length > config.documentMaxUploadBytes) {
    const err = new Error('Файл превышает максимальный размер');
    err.statusCode = 413;
    err.code = 'payload_too_large';
    throw err;
  }

  const encrypted = encryptDocument(data.file_buffer);

  const document = await prisma.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: {
        case_id: caseId,
        uploader_id: currentUser.id,
        filename: data.filename,
        storage_key: data.storage_key || buildStorageKey(caseId, data.filename),
        mime_type: data.mime_type,
        file_size_bytes: data.file_buffer.length,
        sha256_hash: encrypted.sha256Hash,
        encryption_algorithm: encrypted.algorithm,
        encryption_iv: encrypted.iv,
        encryption_tag: encrypted.tag,
        encrypted_data: encrypted.encryptedData,
        description: data.description || null,
      },
      select: documentSelect(),
    });

    await tx.case.update({
      where: { id: caseId },
      data: { last_activity_at: new Date() },
    });

    await tx.auditLog.create({
      data: {
        user_id: currentUser.id,
        action: 'document_uploaded',
        resource_type: 'document',
        resource_id: created.id,
        metadata: { case_id: caseId, filename: created.filename, sha256_hash: created.sha256_hash },
      },
    });

    return created;
  });

  return sanitizeDocument(document);
}

async function getDocumentFile(caseId, documentId, currentUser) {
  await getAccessibleCase(caseId, currentUser);

  const document = await prisma.document.findFirst({
    where: { id: documentId, case_id: caseId },
    select: {
      id: true,
      case_id: true,
      filename: true,
      mime_type: true,
      file_size_bytes: true,
      sha256_hash: true,
      encryption_algorithm: true,
      encryption_iv: true,
      encryption_tag: true,
      encrypted_data: true,
    },
  });

  if (!document) {
    const err = new Error('Документ не найден');
    err.statusCode = 404;
    err.code = 'not_found';
    throw err;
  }

  const fileBuffer = decryptDocument(document);
  return { document, fileBuffer };
}

async function listNotes(caseId, { cursor, limit }, currentUser) {
  await getAccessibleCase(caseId, currentUser);

  const take = Math.min(limit || 20, 100);
  const notes = await prisma.caseNote.findMany({
    where: { case_id: caseId },
    take: take + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    orderBy: { created_at: 'desc' },
    include: {
      author: {
        select: { id: true, full_name: true, email: true, role: true, is_active: true },
      },
    },
  });

  return paginationResult(notes, take);
}

async function createNote(caseId, data, currentUser) {
  await getAccessibleCase(caseId, currentUser, { write: true });

  const note = await prisma.$transaction(async (tx) => {
    const created = await tx.caseNote.create({
      data: {
        case_id: caseId,
        author_id: currentUser.id,
        body: data.body,
      },
      include: {
        author: {
          select: { id: true, full_name: true, email: true, role: true, is_active: true },
        },
      },
    });

    await tx.case.update({
      where: { id: caseId },
      data: { last_activity_at: new Date() },
    });

    await tx.auditLog.create({
      data: {
        user_id: currentUser.id,
        action: 'note_added',
        resource_type: 'case_note',
        resource_id: created.id,
        metadata: { case_id: caseId },
      },
    });

    return created;
  });

  return note;
}

module.exports = {
  listCases,
  getCaseDetail,
  updateStatus,
  reassignLawyer,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  listDocuments,
  createDocument,
  getDocumentFile,
  listNotes,
  createNote,
};
