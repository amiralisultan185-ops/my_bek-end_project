# LexLink Pre-Defense Compliance Checklist

## 1. Repository Deliverables

- [x] `.env.example` contains all required environment variables.
- [x] `README.md` contains setup and run instructions.
- [x] `openapi.yaml` documents implemented API endpoints.
- [x] `prisma/migrations/` contains Prisma migration history for the final schema.
- [x] `tests/` contains unit and integration tests.
- [x] `LexLink.postman_collection.json` contains defense-ready API requests.
- [ ] GitHub repository must be uploaded and shared with the instructor.

## 2. Infrastructure

- [x] Express API runs on port `3001`.
- [x] PostgreSQL is configured through `DATABASE_URL`.
- [x] Redis is configured through `REDIS_URL`.
- [x] Prisma Client is generated from `schema.prisma`.
- [x] App validates critical environment variables at boot.
- [x] Production CORS rejects wildcard origins.
- [x] Docker Compose is available for Postgres, Redis, and the app.
- [ ] Docker Desktop/PostgreSQL/Redis must be running before live tests.

## 3. Authentication And Authorization

- [x] Director registration exists.
- [x] Client registration exists.
- [x] Login uses JWT access tokens.
- [x] Refresh token rotation is implemented.
- [x] Logout revokes refresh tokens.
- [x] Email verification is required before login.
- [x] Email verification code can be resent.
- [x] Password reset via email code is implemented.
- [x] `must_change_password` blocks protected work until password is changed.
- [x] RBAC middleware protects business endpoints.
- [x] Rate limiting protects auth and public submit endpoints.

## 4. Roles

- [x] `owner`
- [x] `director`
- [x] `senior_lawyer`
- [x] `lawyer`
- [x] `assistant`
- [x] `client`
- [x] `auditor`

## 5. Business Workflows

- [x] Public client inquiry submission.
- [x] OTP verification for public inquiry.
- [x] OTP resend with cooldown.
- [x] Client account can submit linked inquiries.
- [x] Client can register after an inquiry and link confirmed inquiries by email.
- [x] Owner/director can create staff users.
- [x] Bulk staff creation exists.
- [x] Staff temporary password reset exists.
- [x] Director can assign inquiries to lawyers.
- [x] Cases can be listed and viewed based on role access.
- [x] Cases can be reassigned.
- [x] Case status can be changed.
- [x] Groups can be created.
- [x] Users can be added to groups.
- [x] Cases can be linked to groups.
- [x] Assistant/auditor group-based case visibility exists.
- [x] Director change workflow exists.
- [x] Old director becomes `senior_lawyer`.

## 6. Background Jobs And Email

- [x] Email sending is queued through Redis.
- [x] Email worker processes queued jobs.
- [x] Email jobs track status, attempts, and errors.
- [x] Queue visibility endpoints exist: `GET /jobs/email`, `GET /jobs/email/:job_id`.
- [x] Email verification emails are queued.
- [x] Password reset emails are queued.
- [x] Client inquiry confirmation emails are queued.
- [x] Assignment notification emails are queued.
- [ ] Real SMTP credentials must be configured for live inbox demonstration.

## 7. API Documentation

- [x] Swagger UI is mounted at `/docs`.
- [x] Auth endpoints are documented.
- [x] Client endpoints are documented.
- [x] User/staff endpoints are documented.
- [x] Job visibility endpoints are documented.
- [x] Pagination is present on list endpoints.
- [ ] Final manual Swagger review should be done before defense.

## 8. Testing

- [x] Auth integration tests cover registration, email verification, login, refresh, logout.
- [x] Tests cover client linked inquiry flow.
- [x] Tests cover password reset by email code.
- [x] Tests cover director transfer.
- [x] Tests cover staff password reset.
- [ ] Full test suite requires running PostgreSQL and Redis.

## 9. Defense Demonstration Order

1. Start Docker Desktop.
2. Run `docker compose up -d postgres redis`.
3. Run `npx prisma migrate reset --force`.
4. Run `npm run dev`.
5. Open Swagger: `http://localhost:3001/docs`.
6. Open Postman collection.
7. Demonstrate:
   - Register director.
   - Verify director email.
   - Login director.
   - Create owner/staff.
   - Register client.
   - Verify client email.
   - Submit linked client inquiry.
   - Verify inquiry OTP.
   - Assign inquiry to lawyer.
   - Show case.
   - Show email queue jobs.
   - Run tests.
