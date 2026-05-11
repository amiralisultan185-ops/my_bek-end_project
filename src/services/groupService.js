const prisma = require('../utils/prisma');
const { writeAuditLog } = require('../utils/audit');

function toSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function createGroup(data, createdById) {
  const slug = (data.slug ? toSlug(data.slug) : toSlug(data.name)) || `group-${Date.now()}`;

  if (!slug) {
    const err = new Error('Некорректный slug группы');
    err.statusCode = 422;
    err.code = 'validation_error';
    throw err;
  }

  const group = await prisma.group.create({
    data: {
      name: data.name,
      slug,
      type: data.type || 'custom',
      description: data.description || null,
      created_by: createdById,
    },
  });

  await writeAuditLog({
    userId: createdById,
    action: 'group_created',
    resourceType: 'group',
    resourceId: group.id,
    metadata: { name: group.name, slug: group.slug, type: group.type },
  });

  return group;
}

async function listGroups({ type }) {
  const where = {};
  if (type) where.type = type;

  return prisma.group.findMany({
    where,
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    include: {
      _count: {
        select: { members: true, cases: true },
      },
    },
  });
}

async function addUserToGroup(groupId, userId, assignedById) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true },
  });

  if (!group) {
    const err = new Error('Группа не найдена');
    err.statusCode = 404;
    err.code = 'not_found';
    throw err;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, is_active: true },
  });

  if (!user || !user.is_active) {
    const err = new Error('Активный пользователь не найден');
    err.statusCode = 422;
    err.code = 'validation_error';
    throw err;
  }

  const membership = await prisma.userGroup.upsert({
    where: {
      user_id_group_id: {
        user_id: userId,
        group_id: groupId,
      },
    },
    create: {
      user_id: userId,
      group_id: groupId,
      assigned_by: assignedById,
    },
    update: {},
    include: {
      user: {
        select: { id: true, full_name: true, email: true, role: true, is_active: true },
      },
      group: true,
    },
  });

  await writeAuditLog({
    userId: assignedById,
    action: 'group_member_added',
    resourceType: 'group',
    resourceId: groupId,
    metadata: { user_id: userId },
  });

  return membership;
}

async function addCaseToGroup(groupId, caseId, assignedById) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true },
  });

  if (!group) {
    const err = new Error('Группа не найдена');
    err.statusCode = 404;
    err.code = 'not_found';
    throw err;
  }

  const caseRecord = await prisma.case.findUnique({
    where: { id: caseId },
    select: { id: true },
  });

  if (!caseRecord) {
    const err = new Error('Дело не найдено');
    err.statusCode = 404;
    err.code = 'not_found';
    throw err;
  }

  const caseGroup = await prisma.caseGroup.upsert({
    where: {
      case_id_group_id: {
        case_id: caseId,
        group_id: groupId,
      },
    },
    create: {
      case_id: caseId,
      group_id: groupId,
      assigned_by: assignedById,
    },
    update: {},
    include: {
      case: {
        select: { id: true, status: true, lawyer_id: true },
      },
      group: true,
    },
  });

  await writeAuditLog({
    userId: assignedById,
    action: 'case_group_added',
    resourceType: 'case',
    resourceId: caseId,
    metadata: { group_id: groupId },
  });

  return caseGroup;
}

module.exports = {
  createGroup,
  listGroups,
  addUserToGroup,
  addCaseToGroup,
};
