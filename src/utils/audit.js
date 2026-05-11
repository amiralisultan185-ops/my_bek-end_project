const prisma = require('./prisma');

async function writeAuditLog({ userId, action, resourceType, resourceId, metadata, ipAddress }) {
  try {
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        metadata: metadata || undefined,
        ip_address: ipAddress,
      },
    });
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
}

module.exports = { writeAuditLog };
