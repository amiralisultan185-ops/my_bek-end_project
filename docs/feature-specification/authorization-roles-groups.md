# Authorization, Roles, and Groups

## Role Hierarchy

| Role | Purpose | Main permissions |
|---|---|---|
| `owner` | Highest business authority | Manage users, groups, inquiries, cases, owners |
| `director` | Operational manager | Manage staff, groups, inquiries, assignment, case completion |
| `senior_lawyer` | Experienced legal worker | Work assigned cases and submit review |
| `lawyer` | Legal worker | Work assigned cases and submit review |
| `assistant` | Support staff | Read and assist cases through group access |
| `auditor` | Read-only reviewer | Read cases through group access |
| `client` | External client | Own client account and linked inquiries |

## Staff Creation

Owner or director creates staff through `POST /users`.

The system:

- Generates a temporary password.
- Stores only the password hash.
- Returns the temporary password once in the API response.
- Queues an email with the temporary password.
- Queues an email verification code.
- Marks `must_change_password = true`.

The staff member must verify email, log in, and change the temporary password before normal protected work.

## Director Change

Only a user with `users:manage` can call `PATCH /users/:user_id/make-director`.

Business rule:

- The new director must be an active assignable legal worker.
- The new director must not have active cases.
- Existing active directors are demoted to `senior_lawyer`.
- The selected user becomes `director`.
- The change is written to `audit_logs`.

## Groups

Groups provide controlled access to cases for support and review roles.

Flow:

1. Manager creates a group with `POST /groups`.
2. Manager adds staff to the group with `POST /groups/:group_id/members`.
3. Manager attaches a case to the group with `POST /groups/:group_id/cases`.
4. Assistants can read and assist cases in their groups.
5. Auditors can only read cases in their groups.

## Case Subresources

Cases now support:

- Tasks: `/cases/:case_id/tasks`
- Encrypted document upload/download: `/cases/:case_id/documents`
- Internal notes: `/cases/:case_id/notes`

Management and assigned legal workers can write. Assistants can write only when they have group assist access. Auditors remain read-only.

Documents are not stored as plain files. The backend accepts raw binary, calculates SHA-256 for integrity, encrypts the content with AES-256-GCM, and stores encrypted bytes in PostgreSQL.

## Permission Storage

Permissions exist in two layers:

- `role_permissions` table for database-backed RBAC.
- `src/utils/roles.js` fallback for local resilience.

The middleware checks the database table first and uses fallback permissions only if the DB lookup fails.
