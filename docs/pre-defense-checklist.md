# POWER LAW Digital Pre-Defense Checklist

Use this checklist before opening the project for review.

## Environment

- PostgreSQL is running on the configured `DATABASE_URL`.
- Redis is running on the configured `REDIS_URL`.
- `.env` exists and is based on `.env.example`.
- `APP_SECRET_KEY` is at least 32 characters.
- `DOCUMENT_ENCRYPTION_KEY` is set for production or real demo security.
- Production CORS does not use `*`.
- Real SMTP credentials are configured when demonstrating real email delivery.

## Database

- `npx prisma generate` completes successfully.
- `npx prisma migrate deploy` completes successfully on the target database.
- For local demo reset, `npx prisma migrate reset --force` completes successfully.
- `npm run db:seed` creates the initial owner.

## Authentication Demo

- Login as seeded owner.
- Create staff through `POST /users`.
- Show temporary password in the response and email job.
- Verify the staff email with `POST /auth/verify-email`.
- Login as staff with temporary password.
- Show that protected work is blocked until password change.
- Change password through `PATCH /users/me`.
- Refresh token through `POST /auth/refresh`.
- Logout through `POST /auth/logout`.

## Business Workflow Demo

- Submit public inquiry through `POST /submit`.
- Verify inquiry OTP through `POST /submit/verify`.
- Assign inquiry to lawyer through `POST /inquiries/:id/assign`.
- Open created case through `GET /cases/:id`.
- Create and list a task through `/cases/:id/tasks`.
- Upload an encrypted binary document through `/cases/:id/documents`.
- Download and verify the document through `/cases/:id/documents/:document_id/download`.
- Create and list an internal note through `/cases/:id/notes`.
- Create a group through `POST /groups`.
- Add a user to the group.
- Attach a case to the group.
- Show assistant/auditor group-based access.

## Background Jobs

- Trigger at least one email-producing action.
- Open `GET /jobs/email`.
- Open one job through `GET /jobs/email/:job_id`.
- Explain `queued`, `processing`, `completed`, and `failed`.

## Quality Checks

- `npm run lint`
- `npm test`
- `node -e "const YAML=require('yamljs'); YAML.load('openapi.yaml'); JSON.parse(require('fs').readFileSync('PowerLawDigital.postman_collection.json','utf8')); console.log('docs ok')"`

## Repository

- `git status` contains only intended changes before commit.
- README, `.env.example`, `openapi.yaml`, Prisma migrations, tests, and Postman collection are present.
- Project is pushed to GitHub.
