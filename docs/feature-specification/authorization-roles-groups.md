# Feature Specification: Authorization, Roles, Permissions, and Groups

## 1. Purpose

LexLink must support internal staff authorization through roles, permissions, groups, and JWT-based authentication.

Client authentication is out of scope for this feature. Clients continue to use the public OTP submission flow.

## 2. Roles

The system supports the following roles:

| Role | Purpose |
|---|---|
| `owner` | System owner with the highest level of access |
| `director` | Legal operations manager |
| `senior_lawyer` | Senior legal worker |
| `lawyer` | Regular legal worker |
| `assistant` | Legal assistant |
| `auditor` | Read-only reviewer/observer |
| `client` | Reserved for future client portal functionality |

## 3. Permissions

Permissions are stored in the `role_permissions` table.

Supported permissions:

```txt
users:manage
groups:manage
inquiries:manage
cases:read_all
cases:assign
cases:reassign
cases:complete
cases:read_assigned
cases:work_assigned
cases:submit_review
cases:read_group
cases:assist_group
owner:create
```

## 4. Role Permission Matrix

| Role | Permissions |
|---|---|
| `owner` | Manage users, groups, inquiries, all cases, and additional owners |
| `director` | Manage users, groups, inquiries, and all cases |
| `senior_lawyer` | Read assigned cases, work on assigned cases, submit assigned cases for review |
| `lawyer` | Read assigned cases, work on assigned cases, submit assigned cases for review |
| `assistant` | Read group-linked cases and assist on group-linked cases |
| `auditor` | Read group-linked cases only |
| `client` | Not used in internal authorization |

## 5. Staff Registration and Login

The first director is created through:

```txt
POST /auth/register
```

After that, internal staff members are created through:

```txt
POST /users
```

Staff users can be created by:

```txt
owner
director
```

When a staff user is created:

- the system generates a temporary password;
- the password is linked to the user's email account;
- `must_change_password` is set to `true`;
- in development mode, the temporary password is printed through the mock email logger.

## 6. First Login Flow

A staff user logs in through:

```txt
POST /auth/login
```

If `must_change_password = true`, the user can only access:

```txt
GET /users/me
PATCH /users/me
```

All other protected endpoints return:

```txt
403 password_change_required
```

After the user changes the password through:

```txt
PATCH /users/me
```

the system sets:

```txt
must_change_password = false
```

## 7. Owner Creation Flow

The first `owner` can be created by a `director`.

If at least one active `owner` already exists:

- only an existing `owner` can create additional owners;
- a `director` can no longer create additional owners.

Endpoint:

```txt
POST /users
```

Example body:

```json
{
  "email": "owner@lexlink.io",
  "full_name": "System Owner",
  "phone": "+77010000001",
  "role": "owner"
}
```

## 8. Director Replacement Flow

A new director can be assigned through:

```txt
PATCH /users/:user_id/make-director
```

Rules:

- available to `owner` and `director`;
- the new director must be an active `lawyer` or `senior_lawyer`;
- the new director must not have active cases;
- all active directors are converted to `lawyer`;
- the selected user becomes the new `director`.

Current behavior:

```txt
old director -> lawyer
selected user -> director
```

## 9. User Management Endpoints

```txt
GET /users/me
PATCH /users/me
GET /users
GET /users/all
POST /users
POST /users/bulk
PATCH /users/:user_id/make-director
PATCH /users/:user_id/deactivate
```

| Endpoint | Purpose |
|---|---|
| `GET /users/me` | Return current authenticated user |
| `PATCH /users/me` | Update profile or change password |
| `GET /users` | Return lawyer workload dashboard |
| `GET /users/all` | Return all internal users |
| `POST /users` | Create one staff user |
| `POST /users/bulk` | Create multiple staff users |
| `PATCH /users/:user_id/make-director` | Assign a new director |
| `PATCH /users/:user_id/deactivate` | Deactivate a staff user |

## 10. Groups

Groups organize users and cases.

Supported group types:

```txt
legal_area
branch
client_segment
review
custom
```

Database models:

```txt
Group
UserGroup
CaseGroup
```

Group endpoints:

```txt
GET /groups
POST /groups
POST /groups/:group_id/members
POST /groups/:group_id/cases
```

## 11. Group-Based Case Access

A user can access a case through group access when all conditions are true:

1. the user belongs to a group;
2. the case is linked to the same group;
3. the user's role has `cases:read_group`.

This is mainly used by:

```txt
assistant
auditor
```

## 12. Case Access

| Role | Case Access |
|---|---|
| `owner` | All cases |
| `director` | All cases |
| `senior_lawyer` | Assigned cases only |
| `lawyer` | Assigned cases only |
| `assistant` | Group-linked cases only |
| `auditor` | Group-linked cases only, read-only |

Case endpoints:

```txt
GET /cases
GET /cases/:case_id
PATCH /cases/:case_id/status
PATCH /cases/:case_id/reassign
```

Rules:

- `owner` and `director` can access all cases;
- `senior_lawyer` and `lawyer` can access only their assigned cases;
- `assistant` and `auditor` can access only group-linked cases;
- `PATCH /cases/:case_id/reassign` requires `cases:reassign`;
- only management roles can complete or reopen cases;
- legal workers can submit their assigned cases for review.

## 13. Inquiry Access

Inquiries are managed by roles with:

```txt
inquiries:manage
```

Currently:

```txt
owner
director
```

Inquiry endpoints:

```txt
GET /inquiries
GET /inquiries/:inquiry_id
POST /inquiries/:inquiry_id/assign
```

## 14. Public Client Flow

Client authentication was not changed.

Public endpoints:

```txt
POST /submit
POST /submit/verify
POST /submit/resend
```

Flow:

1. client submits an inquiry;
2. system creates an inquiry with `pending_verification`;
3. client verifies email through OTP;
4. inquiry becomes `new`.

## 15. Postman Collection

Postman collection:

```txt
LexLink.postman_collection.json
```

Main folders:

```txt
Auth
Quick Create Staff
Users
Groups
Inquiries
Cases
Public Submit
```

For staff creation demos, use:

```txt
Quick Create Staff
```

It contains separate requests for:

```txt
Create owner
Create senior lawyer
Create lawyer
Create assistant
Create auditor
```

## 16. Local Environment

Local ports:

```txt
API: http://localhost:3001
Swagger: http://localhost:3001/docs
Postgres: 127.0.0.1:55432
Redis: localhost:6379
```

Expected `.env`:

```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://lexlink:lexlink@127.0.0.1:55432/lexlink?schema=public
REDIS_URL=redis://localhost:6379/0
APP_SECRET_KEY=LexLinkSuperSecretKey2026MinLen32OK
```

## 17. Acceptance Criteria

The feature is considered complete when:

- the first director can be created;
- the director can log in;
- the director can create the first owner;
- owner/director can create staff users;
- staff users receive temporary passwords;
- a user with a temporary password cannot use protected business endpoints before changing the password;
- after password change, the user receives access according to role and permissions;
- `GET /users/all` returns all staff users;
- `assistant` and `auditor` cannot access all cases by default;
- `assistant` and `auditor` can access only cases linked to their groups;
- `owner` and `director` can access and manage all cases;
- `lawyer` and `senior_lawyer` can access only assigned cases;
- Postman collection contains separate staff creation requests for every role.
