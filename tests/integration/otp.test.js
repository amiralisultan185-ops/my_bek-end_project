const otpService = require('../../src/services/otpService');
const prisma = require('../../src/utils/prisma');
const redis = require('../../src/utils/redis');

describe('OTP Integration', () => {
  afterAll(async () => {
    await prisma.$disconnect();
    await redis.quit();
  });

  beforeEach(async () => {
    await prisma.caseGroup.deleteMany();
    await prisma.caseHistory.deleteMany();
    await prisma.task.deleteMany();
    await prisma.document.deleteMany();
    await prisma.caseNote.deleteMany();
    await prisma.case.deleteMany();
    await prisma.inquiryOTP.deleteMany();
    await prisma.clientInquiry.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await redis.flushdb();
  });

  test('generateCode returns 6-digit string', () => {
    const code = otpService.generateCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  test('createOTP stores hashed code', async () => {
    const inquiry = await prisma.clientInquiry.create({
      data: {
        full_name: 'Test Client',
        email: 'test@example.invalid',
        phone: '+70000000000',
        category: 'labor',
        description: 'This is a long enough legal inquiry description for the integration test case.',
      },
    });

    const code = await otpService.createOTP(inquiry.id);
    expect(code).toMatch(/^\d{6}$/);

    const otpRecord = await prisma.inquiryOTP.findUnique({
      where: { inquiry_id: inquiry.id },
    });
    expect(otpRecord).toBeTruthy();
    expect(otpRecord.code_hash).not.toBe(code);
    expect(otpRecord.attempts).toBe(0);
  });
});
