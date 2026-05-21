# POWER LAW Digital

POWER LAW Digital is a production-oriented legal services platform with an Express/Prisma backend, PostgreSQL, Redis-backed email jobs, and a full frontend application.

## Docker Start

Use the standard Docker Compose flow:

```powershell
cd C:\Users\<your-user>\Downloads\lexlink-api-fixed\lexlink-fixed
copy .env.example .env
docker compose up --build
```

Local URLs:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:3001
Swagger:  http://localhost:3001/docs
Health:   http://localhost:3001/health
```

The backend container automatically runs:

```text
prisma migrate deploy
npm run db:seed
node src/server.js
```

Default seeded owner:

```text
Email:    owner@example.invalid
Password: OwnerPass123!
Role:     owner
```

## Stop

```powershell
docker compose down
```

## Reset Local Database

This deletes local PostgreSQL/Redis Docker volumes:

```powershell
docker compose down -v
docker compose up --build
```

## Logs

```powershell
docker compose logs -f app frontend postgres redis
```

## Tests

Start PostgreSQL and Redis first:

```powershell
docker compose up -d postgres redis
npm.cmd test
```

Useful focused commands:

```powershell
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run lint
npm.cmd run email:check
```

## Environment Variables

Critical production variables are listed in `.env.example`.

Required for deployment:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET_KEY` | Access token signing secret |
| `JWT_REFRESH_SECRET_KEY` | Refresh token signing secret |
| `EMAIL_API_KEY` / `SMTP_PASSWORD` | Email provider API key or SMTP password |
| `EMAIL_FROM_ADDRESS` / `EMAIL_FROM` | Verified sender identity |
| `BACKEND_PORT` | Backend port |
| `FRONTEND_PORT` | Frontend port |
| `ENVIRONMENT` / `NODE_ENV` | `development` or `production` |
| `CORS_ORIGINS` / `ALLOWED_ORIGINS` | Comma-separated allowed origins |
| `DOCUMENT_ENCRYPTION_KEY` | AES-256-GCM document encryption secret |

For Docker Compose and DeployRocks, use service names:

```env
DATABASE_URL=postgresql://lexlink:lexlink@postgres:5432/lexlink?schema=public
REDIS_URL=redis://redis:6379/0
```

Production mode refuses to boot without real SMTP credentials, safe CORS origins, database URL, Redis URL, and document encryption key.

## Real Email Setup

Development can print mock emails to logs. Production must use a real SMTP provider.

Example SendGrid-style SMTP:

```env
ENVIRONMENT=production
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
EMAIL_API_KEY=your-sendgrid-api-key
EMAIL_FROM_ADDRESS=POWER LAW Digital <verified-sender@example.invalid>
EMAIL_QUEUE_ENABLED=true
EMAIL_WORKER_ENABLED=true
```

Emails are queued through Redis. API endpoints do not block while the provider sends the email.

Business emails implemented:

- Account email verification
- Password reset
- Client inquiry confirmation
- New inquiry notification to director
- Case assignment notification to lawyer
- Temporary staff password delivery

Queue visibility:

```text
GET /jobs/email
GET /jobs/email/:job_id
```

Detailed SMTP setup:

```text
docs/smtp-setup.md
```

## Main Workflows

### Auth

1. Register director/client or seed owner.
2. Receive verification email.
3. Verify with `POST /auth/verify-email`.
4. Login with `POST /auth/login`.
5. Use Bearer access token on protected routes.
6. Rotate refresh token with `POST /auth/refresh`.
7. Logout with `POST /auth/logout`.

### Staff

1. Owner/director creates staff with `POST /users`.
2. API returns and emails a temporary password.
3. Staff verifies email.
4. Staff logs in and must change the temporary password through `PATCH /users/me`.

### Client Inquiry and Case

1. Client submits `POST /submit`.
2. Client verifies OTP with `POST /submit/verify`.
3. Director/owner lists inquiries and assigns a lawyer.
4. Assignment creates a case and sends a notification.
5. Authorized staff manages tasks, encrypted documents, and notes.

### Case Work

```text
GET    /cases/:case_id/tasks
POST   /cases/:case_id/tasks
PATCH  /cases/:case_id/tasks/:task_id
DELETE /cases/:case_id/tasks/:task_id
GET    /cases/:case_id/documents
POST   /cases/:case_id/documents
GET    /cases/:case_id/documents/:document_id/download
GET    /cases/:case_id/notes
POST   /cases/:case_id/notes
```

Documents are uploaded as raw binary. The backend stores encrypted bytes in PostgreSQL, calculates SHA-256 for integrity, and decrypts only through the protected download endpoint.

## API Documentation

```text
OpenAPI: openapi.yaml
Swagger: /docs
Postman: PowerLawDigital.postman_collection.json
```

## Migrations

Prisma migration history is stored in:

```text
prisma/migrations
```

Apply migrations manually if needed:

```powershell
npx.cmd prisma migrate deploy
```

## Frontend Application

The frontend application is in `frontend/`. It calls the real backend API and covers:

- Director/client registration
- Email verification and resend
- Login, profile, refresh, logout
- Password reset and temporary password change
- Staff creation and director promotion
- Public inquiry submit/OTP verification
- Inquiry assignment and case creation
- Case tasks, encrypted document upload/download, and notes
- Groups and email job visibility

When running through Docker Compose, the frontend proxies `/api/*` to the backend service.

## Figma Design

The production frontend design is included as a project deliverable:

```text
FIGMA_DESIGN_URL.txt
docs/frontend-figma-design.md
```

Figma file:

```text
https://www.figma.com/design/SzqJk42vNIv3yTVDU0PGhU
```

## Deployment

Preferred platform: DeployRocks.

1. Push this repository to GitHub.
2. Open `https://dashboard.deployrocks.com`.
3. Connect the GitHub repository.
4. Select Docker Compose deployment.
5. Configure production environment variables from `.env.example`.
6. Set `ENVIRONMENT=production`.
7. Use service hostnames `postgres` and `redis` inside URLs.
8. Add the deployed frontend URL to `CORS_ORIGINS`.
9. Deploy and verify `/health`, `/docs`, and the frontend.
10. Save the final public URL in `DEPLOYED_URL.txt`.

If DeployRocks is unavailable, deploy the same Docker Compose stack on Render, Railway, Fly.io, or another provider that supports containers and managed PostgreSQL/Redis.

## Submission Files

- `docker-compose.yml`
- `.env.example`
- `README.md`
- `openapi.yaml`
- `prisma/migrations/`
- `tests/`
- `frontend/`
- `CHECKLIST.txt`
- `DEPLOYED_URL.txt`
- `VIDEO_LINK.txt`

## Security Notes

- No plaintext passwords are stored.
- All database access goes through Prisma ORM.
- Production CORS cannot use wildcard origins.
- Production email cannot use mock delivery.
- Uploaded documents are encrypted before storage.
- Refresh tokens are rotated and revoked on use/logout.
