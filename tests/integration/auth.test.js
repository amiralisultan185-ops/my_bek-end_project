const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/utils/prisma');
const redis = require('../../src/utils/redis');
const authCodeService = require('../../src/services/authCodeService');

describe('Auth Integration', () => {
  afterAll(async () => {
    await prisma.$disconnect();
    await redis.quit();
  });

  beforeEach(async () => {
    await prisma.caseGroup.deleteMany();
    await prisma.userGroup.deleteMany();
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

  async function verifyUserEmail(email) {
    const user = await prisma.user.findUnique({ where: { email } });
    const code = await authCodeService.createEmailVerificationCode(user.id);
    const res = await request(app).post('/auth/verify-email').send({ email, code });
    expect(res.status).toBe(200);
  }

  async function registerVerifiedDirector() {
    const res = await request(app).post('/auth/register').send({
      email: 'director@lexlink.io',
      password: 'SecurePass!9',
      full_name: 'Main Director',
    });
    expect(res.status).toBe(201);
    await verifyUserEmail('director@lexlink.io');
    return res;
  }

  async function loginDirector() {
    await registerVerifiedDirector();
    const res = await request(app).post('/auth/login').send({
      email: 'director@lexlink.io',
      password: 'SecurePass!9',
    });
    expect(res.status).toBe(200);
    return res;
  }

  test('POST /auth/register creates director when none exists', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'director@lexlink.io',
      password: 'SecurePass!9',
      full_name: 'Main Director',
    });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('director@lexlink.io');
    expect(res.body.role).toBe('director');
  });

  test('POST /auth/register fails when director exists', async () => {
    await request(app).post('/auth/register').send({
      email: 'director@lexlink.io',
      password: 'SecurePass!9',
      full_name: 'Main Director',
    });

    const res = await request(app).post('/auth/register').send({
      email: 'another@lexlink.io',
      password: 'SecurePass!9',
      full_name: 'Another Director',
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden');
  });

  test('Unverified users cannot log in before email verification', async () => {
    await request(app).post('/auth/client/register').send({
      email: 'unverified@lexlink.io',
      password: 'ClientPass!9',
      full_name: 'Unverified Client',
      phone: '+77001112233',
    });

    const res = await request(app).post('/auth/login').send({
      email: 'unverified@lexlink.io',
      password: 'ClientPass!9',
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('email_not_verified');
  });

  test('POST /auth/login returns tokens after email verification', async () => {
    const res = await loginDirector();

    expect(res.body.access_token).toBeTruthy();
    expect(res.body.refresh_token).toBeTruthy();
    expect(res.body.token_type).toBe('bearer');
    expect(res.body.user.role).toBe('director');
  });

  test('POST /auth/login rejects wrong password', async () => {
    await registerVerifiedDirector();

    const res = await request(app).post('/auth/login').send({
      email: 'director@lexlink.io',
      password: 'WrongPass!9',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  test('POST /auth/refresh rotates tokens', async () => {
    const loginRes = await loginDirector();

    const res = await request(app).post('/auth/refresh').send({
      refresh_token: loginRes.body.refresh_token,
    });

    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeTruthy();
    expect(res.body.refresh_token).toBeTruthy();
  });

  test('POST /auth/logout revokes token', async () => {
    const loginRes = await loginDirector();

    const res = await request(app).post('/auth/logout').send({
      refresh_token: loginRes.body.refresh_token,
    });

    expect(res.status).toBe(204);

    const refreshRes = await request(app).post('/auth/refresh').send({
      refresh_token: loginRes.body.refresh_token,
    });
    expect(refreshRes.status).toBe(401);
  });

  test('Protected endpoint rejects missing token', async () => {
    const res = await request(app).get('/inquiries');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  test('Director can transfer director role to an active lawyer', async () => {
    const dirLogin = await loginDirector();
    const dirToken = dirLogin.body.access_token;
    const oldDirectorId = dirLogin.body.user.id;

    const lawyerRes = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${dirToken}`)
      .send({
        email: 'new-director@lexlink.io',
        full_name: 'New Director Candidate',
        role: 'lawyer',
      });

    const res = await request(app)
      .patch(`/users/${lawyerRes.body.id}/make-director`)
      .set('Authorization', `Bearer ${dirToken}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(lawyerRes.body.id);
    expect(res.body.role).toBe('director');

    const users = await prisma.user.findMany({
      select: { id: true, role: true },
      orderBy: { email: 'asc' },
    });

    expect(users.filter(user => user.role === 'director')).toHaveLength(1);
    expect(users.find(user => user.id === oldDirectorId).role).toBe('senior_lawyer');

    const oldDirectorAccess = await request(app)
      .get('/inquiries')
      .set('Authorization', `Bearer ${dirToken}`);

    expect(oldDirectorAccess.status).toBe(403);
  });

  test('Director can reset a staff password and force password change', async () => {
    const dirLogin = await loginDirector();

    const lawyerRes = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${dirLogin.body.access_token}`)
      .send({
        email: 'lawyer@lexlink.io',
        full_name: 'Reset Lawyer',
        role: 'lawyer',
      });

    const resetRes = await request(app)
      .patch(`/users/${lawyerRes.body.id}/reset-password`)
      .set('Authorization', `Bearer ${dirLogin.body.access_token}`)
      .send();

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.temp_password).toBeTruthy();
    expect(resetRes.body.user.must_change_password).toBe(true);

    await verifyUserEmail('lawyer@lexlink.io');

    const loginRes = await request(app).post('/auth/login').send({
      email: 'lawyer@lexlink.io',
      password: resetRes.body.temp_password,
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.must_change_password).toBe(true);
  });

  test('Client can register and submit an inquiry linked to the client account', async () => {
    const registerRes = await request(app).post('/auth/client/register').send({
      email: 'client@lexlink.io',
      password: 'ClientPass!9',
      full_name: 'Client Person',
      phone: '+77001112233',
    });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.user.role).toBe('client');
    await verifyUserEmail('client@lexlink.io');

    const loginRes = await request(app).post('/auth/login').send({
      email: 'client@lexlink.io',
      password: 'ClientPass!9',
    });

    const inquiryRes = await request(app)
      .post('/submit')
      .set('Authorization', `Bearer ${loginRes.body.access_token}`)
      .send({
        full_name: 'Ignored Public Name',
        email: 'ignored@example.com',
        phone: '+77009998877',
        category: 'family',
        description: 'This is a sufficiently detailed legal inquiry for integration testing purposes.',
      });

    expect(inquiryRes.status).toBe(201);

    const inquiry = await prisma.clientInquiry.findUnique({
      where: { id: inquiryRes.body.inquiry_id },
      select: { client_user_id: true, email: true, full_name: true, phone: true },
    });

    expect(inquiry.client_user_id).toBe(registerRes.body.user.id);
    expect(inquiry.email).toBe('client@lexlink.io');
    expect(inquiry.full_name).toBe('Client Person');
    expect(inquiry.phone).toBe('+77001112233');
  });

  test('Password reset via email code changes the password', async () => {
    await request(app).post('/auth/client/register').send({
      email: 'reset-client@lexlink.io',
      password: 'ClientPass!9',
      full_name: 'Reset Client',
      phone: '+77001112233',
    });
    await verifyUserEmail('reset-client@lexlink.io');

    const forgotRes = await request(app).post('/auth/password/forgot').send({
      email: 'reset-client@lexlink.io',
    });
    expect(forgotRes.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { email: 'reset-client@lexlink.io' } });
    const code = await authCodeService.createPasswordResetCode(user.id);

    const resetRes = await request(app).post('/auth/password/reset').send({
      email: 'reset-client@lexlink.io',
      code,
      new_password: 'NewClientPass!9',
    });
    expect(resetRes.status).toBe(204);

    const loginRes = await request(app).post('/auth/login').send({
      email: 'reset-client@lexlink.io',
      password: 'NewClientPass!9',
    });
    expect(loginRes.status).toBe(200);
  });
});
