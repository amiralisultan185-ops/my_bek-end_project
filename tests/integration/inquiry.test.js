const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/utils/prisma');
const redis = require('../../src/utils/redis');
const authCodeService = require('../../src/services/authCodeService');

describe('Inquiry & Assignment Integration', () => {
  let directorToken;
  let lawyerId;

  beforeAll(async () => {
    await prisma.caseGroup.deleteMany();
    await prisma.userGroup.deleteMany();
    await prisma.caseHistory.deleteMany();
    await prisma.task.deleteMany();
    await prisma.document.deleteMany();
    await prisma.caseNote.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.case.deleteMany();
    await prisma.inquiryOTP.deleteMany();
    await prisma.clientInquiry.deleteMany();
    await prisma.user.deleteMany();
    await redis.flushdb();

    await request(app).post('/auth/register').send({
      email: 'director@example.invalid',
      password: 'SecurePass!9',
      full_name: 'Main Director',
    });
    await verifyUserEmail('director@example.invalid');

    const loginRes = await request(app).post('/auth/login').send({
      email: 'director@example.invalid',
      password: 'SecurePass!9',
    });
    expect(loginRes.status).toBe(200);
    directorToken = loginRes.body.access_token;

    const lawyerRes = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        email: 'lawyer@example.invalid',
        full_name: 'Test Lawyer',
        role: 'lawyer',
      });
    expect(lawyerRes.status).toBe(201);
    expect(lawyerRes.body.temp_password).toBeTruthy();
    lawyerId = lawyerRes.body.user.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await redis.quit();
  });

  async function verifyUserEmail(email) {
    const user = await prisma.user.findUnique({ where: { email } });
    const code = await authCodeService.createEmailVerificationCode(user.id);
    const res = await request(app).post('/auth/verify-email').send({ email, code });
    expect(res.status).toBe(200);
  }

  test('POST /submit creates inquiry and sends OTP', async () => {
    const res = await request(app).post('/submit').send({
      full_name: 'Ivan Ivanov',
      email: 'ivanov@example.invalid',
      phone: '+7 000 000 00 00',
      category: 'labor',
      description: 'I was dismissed after five years of work and need legal help with the employment dispute.',
    });

    expect(res.status).toBe(201);
    expect(res.body.inquiry_id).toBeTruthy();
    expect(res.body.message).toContain('Код подтверждения отправлен');
  });

  test('POST /submit/verify rejects an invalid OTP code', async () => {
    const submitRes = await request(app).post('/submit').send({
      full_name: 'Petr Petrov',
      email: 'petrov@example.invalid',
      phone: '+7 000 000 00 00',
      category: 'family',
      description: 'I need a consultation about divorce and property division after a long marriage.',
    });
    const inquiryId = submitRes.body.inquiry_id;

    const wrongRes = await request(app).post('/submit/verify').send({
      inquiry_id: inquiryId,
      code: '000000',
    });
    expect(wrongRes.status).toBe(400);
    expect(wrongRes.body.error).toBe('invalid_code');
  });

  test('POST /inquiries/:id/assign creates case atomically', async () => {
    const inquiry = await prisma.clientInquiry.create({
      data: {
        full_name: 'Sidor Sidorov',
        email: 'sidorov@example.invalid',
        phone: '+7 000 000 00 00',
        category: 'criminal',
        description: 'Detailed test inquiry for assigning a lawyer to a criminal law case.',
        status: 'new',
        email_verified_at: new Date(),
      },
    });

    const res = await request(app)
      .post(`/inquiries/${inquiry.id}/assign`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ lawyer_id: lawyerId });

    expect(res.status).toBe(201);
    expect(res.body.case_id).toBeTruthy();

    const updated = await prisma.clientInquiry.findUnique({
      where: { id: inquiry.id },
    });
    expect(updated.status).toBe('assigned');

    const caseRecord = await prisma.case.findUnique({
      where: { id: res.body.case_id },
    });
    expect(caseRecord).toBeTruthy();
    expect(caseRecord.lawyer_id).toBe(lawyerId);
  });

  test('Double assignment returns 409', async () => {
    const inquiry = await prisma.clientInquiry.create({
      data: {
        full_name: 'Double Assignment Test',
        email: 'double@example.invalid',
        phone: '+7 000 000 00 00',
        category: 'corporate',
        description: 'Detailed test inquiry for checking that one inquiry cannot be assigned twice.',
        status: 'new',
        email_verified_at: new Date(),
      },
    });

    await request(app)
      .post(`/inquiries/${inquiry.id}/assign`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ lawyer_id: lawyerId });

    const res = await request(app)
      .post(`/inquiries/${inquiry.id}/assign`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ lawyer_id: lawyerId });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('conflict');
  });

  test('Case task, document, and note endpoints work for management user', async () => {
    const inquiry = await prisma.clientInquiry.create({
      data: {
        full_name: 'Case Work Test',
        email: 'casework@example.invalid',
        phone: '+7 000 000 00 00',
        category: 'labor',
        description: 'Detailed test inquiry for case work endpoints and internal operations.',
        status: 'new',
        email_verified_at: new Date(),
      },
    });

    const assignRes = await request(app)
      .post(`/inquiries/${inquiry.id}/assign`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ lawyer_id: lawyerId });

    expect(assignRes.status).toBe(201);
    const caseId = assignRes.body.case_id;

    const taskCreateRes = await request(app)
      .post(`/cases/${caseId}/tasks`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        title: 'Prepare claim draft',
        description: 'Prepare the first claim draft and collect supporting documents.',
        priority: 'high',
      });

    expect(taskCreateRes.status).toBe(201);
    expect(taskCreateRes.body.id).toBeTruthy();

    const taskListRes = await request(app)
      .get(`/cases/${caseId}/tasks?limit=20`)
      .set('Authorization', `Bearer ${directorToken}`);

    expect(taskListRes.status).toBe(200);
    expect(taskListRes.body.items.length).toBe(1);

    const taskUpdateRes = await request(app)
      .patch(`/cases/${caseId}/tasks/${taskCreateRes.body.id}`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ status: 'in_progress', priority: 'medium' });

    expect(taskUpdateRes.status).toBe(200);
    expect(taskUpdateRes.body.status).toBe('in_progress');

    const documentBuffer = Buffer.from('Encrypted file upload integration test content.');

    const documentRes = await request(app)
      .post(`/cases/${caseId}/documents`)
      .set('Authorization', `Bearer ${directorToken}`)
      .set('Content-Type', 'application/pdf')
      .set('X-Filename', 'claim-draft.pdf')
      .set('X-Description', 'First claim draft for review.')
      .send(documentBuffer);

    expect(documentRes.status).toBe(201);
    expect(documentRes.body.storage_key).toContain(caseId);
    expect(documentRes.body.sha256_hash).toHaveLength(64);
    expect(documentRes.body.encrypted).toBe(true);

    const documentsListRes = await request(app)
      .get(`/cases/${caseId}/documents?limit=20`)
      .set('Authorization', `Bearer ${directorToken}`);

    expect(documentsListRes.status).toBe(200);
    expect(documentsListRes.body.items.length).toBe(1);

    const downloadRes = await request(app)
      .get(`/cases/${caseId}/documents/${documentRes.body.id}/download`)
      .set('Authorization', `Bearer ${directorToken}`);

    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers['x-content-sha256']).toBe(documentRes.body.sha256_hash);
    expect(Buffer.compare(downloadRes.body, documentBuffer)).toBe(0);

    const noteRes = await request(app)
      .post(`/cases/${caseId}/notes`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ body: 'Client confirmed the timeline and sent supporting details.' });

    expect(noteRes.status).toBe(201);
    expect(noteRes.body.author.id).toBeTruthy();

    const notesListRes = await request(app)
      .get(`/cases/${caseId}/notes?limit=20`)
      .set('Authorization', `Bearer ${directorToken}`);

    expect(notesListRes.status).toBe(200);
    expect(notesListRes.body.items.length).toBe(1);
  });
});
