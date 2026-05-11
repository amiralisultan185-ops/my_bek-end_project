# LexLink API

Production-oriented backend for a legal services platform. The system supports staff management, client inquiry intake, OTP verification, case assignment, group-based access, role permissions, JWT authentication, email verification, password reset, audit logging, and Redis-backed email jobs.

## Tech Stack

- Node.js 20
- Express
- Prisma ORM
- PostgreSQL
- Redis
- JWT access and refresh tokens
- Nodemailer SMTP integration
- Jest + Supertest

## Quick Start

```powershell
cd C:\Users\Амир\Downloads\lexlink-api-fixed\lexlink-fixed
copy .env.example .env
npm install
docker compose up -d postgres redis
npx prisma generate
npx prisma migrate reset --force
npm run dev
```

API:

```text
http://localhost:3001
```

Swagger UI:

```text
http://localhost:3001/docs
```

Health check:

```text
http://localhost:3001/health
```

## Environment

Required production variables are documented in `.env.example`.

Important variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `APP_SECRET_KEY` | JWT signing secret, minimum 32 characters |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins, no wildcard in production |
| `SMTP_HOST` | SMTP provider host |
| `SMTP_PORT` | SMTP provider port |
| `SMTP_USER` | SMTP username |
| `SMTP_PASSWORD` | SMTP password |
| `EMAIL_FROM` | Sender identity |
| `EMAIL_QUEUE_ENABLED` | Queue email through Redis |
| `EMAIL_WORKER_ENABLED` | Start the email worker with the API |

The app refuses to boot when critical production settings are invalid.

## Core Workflows

### Auth

1. Register director or client.
2. Receive email verification code.
3. Verify email through `POST /auth/verify-email`.
4. Login through `POST /auth/login`.
5. Use Bearer token for protected endpoints.
6. Rotate refresh token through `POST /auth/refresh`.
7. Logout through `POST /auth/logout`.

### Client Inquiry

1. Public or authenticated client submits `POST /submit`.
2. System creates inquiry in `pending_verification`.
3. System queues OTP email.
4. Client verifies OTP through `POST /submit/verify`.
5. Director/owner sees inquiry and assigns it to a lawyer.
6. Assignment creates a case and queues assignment notification.

### Staff

1. Owner/director creates staff with `POST /users`.
2. System generates temporary password and queues email.
3. Staff verifies email.
4. Staff logs in and must change temporary password before protected work.

### Background Jobs

Email is not sent synchronously from API endpoints. The API enqueues email jobs in Redis. The email worker processes jobs and records:

- status: `queued`, `processing`, `completed`, `failed`
- attempts
- max attempts
- last error

Visibility endpoints:

```text
GET /jobs/email
GET /jobs/email/:job_id
```

## Roles

- `owner`: full business administration, can create additional owners.
- `director`: manages staff, groups, inquiries, assignment, case completion.
- `senior_lawyer`: works assigned cases.
- `lawyer`: works assigned cases.
- `assistant`: group-based support access.
- `auditor`: group-based read-only review access.
- `client`: client account for linked inquiries.

## Migrations

Use Prisma Migrate:

```powershell
npx prisma migrate deploy
```

For local defense/demo reset:

```powershell
npx prisma migrate reset --force
```

## Tests

Run all tests:

```powershell
npm test
```

Run auth integration tests only:

```powershell
npm test -- --runTestsByPath tests/integration/auth.test.js
```

PostgreSQL and Redis must be running before integration tests.

## API Documentation

The OpenAPI contract is in `openapi.yaml` and served live at `/docs`.

Postman collection:

```text
LexLink.postman_collection.json
```

## Defense Checklist

See:

```text
docs/pre-defense-checklist.md
```

## Repository Submission

Upload the full project to GitHub. Do not submit ZIP-only. If the repository is private, add the instructor as a contributor.
