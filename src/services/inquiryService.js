const prisma = require('../utils/prisma');
const otpService = require('./otpService');
const emailService = require('./emailService');
const { writeAuditLog } = require('../utils/audit');
const { getClientIp } = require('../middleware/rateLimit');
const { isAssignableCaseRole } = require('../utils/roles');

async function createInquiry(data, req) {
  const clientUser = req.user?.role === 'client' ? req.user : null;
  const email = clientUser?.email || data.email;
  const fullName = clientUser?.full_name || data.full_name;
  const phone = clientUser?.phone || data.phone;

  const inquiry = await prisma.clientInquiry.create({
    data: {
      full_name: fullName,
      email,
      phone,
      category: data.category,
      description: data.description,
      desired_timeline: data.desired_timeline,
      status: 'pending_verification',
      client_user_id: clientUser?.id || null,
      ip_address: getClientIp(req),
    },
  });

  const code = await otpService.createOTP(inquiry.id);
  await emailService.sendOTPEmail(inquiry.email, code);

  await writeAuditLog({
    action: 'otp_sent',
    resourceType: 'inquiry',
    resourceId: inquiry.id,
    ipAddress: getClientIp(req),
  });

  return inquiry;
}

async function verifyInquiryOTP(inquiryId, code, req) {
  const inquiry = await otpService.verifyOTP(inquiryId, code);

  // Background notifications (fire and forget)
  emailService.sendDirectorNotification(inquiry).catch(() => {});
  emailService.sendInquiryConfirmation(inquiry.email, inquiry.id).catch(() => {});

  await writeAuditLog({
    action: 'inquiry_submitted',
    resourceType: 'inquiry',
    resourceId: inquiry.id,
    ipAddress: getClientIp(req),
  });

  return inquiry;
}

async function listInquiries({ cursor, limit, status, category, q }) {
  const take = Math.min(limit || 20, 100);
  const where = {};

  if (status) where.status = status;
  if (category) where.category = category;
  if (q) {
    where.OR = [
      { full_name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ];
  }

  // Exclude pending_verification from director view
  where.status = where.status || { not: 'pending_verification' };

  const items = await prisma.clientInquiry.findMany({
    where,
    take: take + 1,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      full_name: true,
      category: true,
      status: true,
      created_at: true,
      case_case: { select: { id: true } },
    },
  });

  let nextCursor = null;
  if (items.length > take) {
    const nextItem = items.pop();
    nextCursor = nextItem.id;
  }

  return {
    items: items.map(i => ({
      ...i,
      case_id: i.case_case?.id || null,
      case_case: undefined,
    })),
    pagination: {
      total_returned: items.length,
      limit: take,
      next_cursor: nextCursor,
    },
  };
}

async function getInquiryDetail(inquiryId) {
  const inquiry = await prisma.clientInquiry.findUnique({
    where: { id: inquiryId },
    include: {
      case_case: {
        select: {
          id: true,
          status: true,
          lawyer: { select: { id: true, full_name: true, email: true } },
        },
      },
    },
  });

  if (!inquiry) {
    const err = new Error('Заявка не найдена');
    err.statusCode = 404;
    err.code = 'not_found';
    throw err;
  }

  return inquiry;
}

async function assignLawyer(inquiryId, lawyerId, assignedById, note) {
  const result = await prisma.$transaction(async (tx) => {
    // Lock inquiry row
    const inquiry = await tx.clientInquiry.findUnique({
      where: { id: inquiryId },
    });

    if (!inquiry) {
      const err = new Error('Заявка не найдена');
      err.statusCode = 404;
      err.code = 'not_found';
      throw err;
    }

    if (inquiry.status !== 'new') {
      const err = new Error('Эта заявка уже назначена юристу.');
      err.statusCode = 409;
      err.code = 'conflict';
      throw err;
    }

    const lawyer = await tx.user.findUnique({
      where: { id: lawyerId },
    });

    if (!lawyer || !lawyer.is_active || !isAssignableCaseRole(lawyer.role)) {
      const err = new Error('Юрист не найден или деактивирован');
      err.statusCode = 422;
      err.code = 'validation_error';
      throw err;
    }

    const newCase = await tx.case.create({
      data: {
        inquiry_id: inquiryId,
        lawyer_id: lawyerId,
        assigned_by: assignedById,
        status: 'active',
        last_activity_at: new Date(),
      },
    });

    await tx.clientInquiry.update({
      where: { id: inquiryId },
      data: { status: 'assigned' },
    });

    await tx.auditLog.create({
      data: {
        user_id: assignedById,
        action: 'case_assigned',
        resource_type: 'case',
        resource_id: newCase.id,
        metadata: { lawyer_id: lawyerId, note: note || null },
      },
    });

    return { case: newCase, inquiry, lawyer };
  }, {
    isolationLevel: 'Serializable',
  });

  // Send notifications outside transaction
  emailService.sendAssignmentNotification(result.lawyer.email, result.inquiry.full_name).catch(() => {});

  return result.case;
}

module.exports = {
  createInquiry,
  verifyInquiryOTP,
  listInquiries,
  getInquiryDetail,
  assignLawyer,
};
