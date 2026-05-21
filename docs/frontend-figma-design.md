# POWER LAW Digital Frontend Figma Design

Figma file:

https://www.figma.com/design/SzqJk42vNIv3yTVDU0PGhU

## Purpose

This file documents the production-grade frontend UI design for POWER LAW Digital, a legal operations platform for a law firm.

The design is not a landing page. It represents a functional SaaS-style legal CRM/dashboard that supports the same workflows implemented in the backend and frontend application.

## Designed Screens

| Screen | Purpose |
|---|---|
| Public/Auth | Login, director/client registration, email verification, password reset, public inquiry submit, OTP verification |
| Dashboard | KPI overview, recent inquiries, active case queue |
| Inquiries | Inquiry filtering, inquiry table, inquiry detail, lawyer assignment |
| Cases | Case list, case detail, status update, lawyer reassignment |
| Tasks | Create, view, update, and delete case tasks |
| Documents | Upload encrypted documents, show SHA-256 hash, download files |
| Notes | Internal notes feed and note creation |
| Staff | Staff list, role/status badges, create staff, temporary password result, make director, reset password, deactivate |
| Groups | Create groups, add users, attach cases |
| Email Jobs | Redis-backed email queue visibility and job details |
| Account | Profile, role badge, temporary password warning, password change |
| Mobile | Responsive mobile auth and operations views |

## Visual Direction

- Professional legal-tech SaaS interface.
- Light theme with white panels and soft gray application background.
- Restrained blue primary actions.
- Teal, amber, red, green, purple, and gray status badges.
- Compact 8px radius cards and panels.
- Dense operational layouts focused on tables, forms, filters, and detail panels.

## Product Coverage

The design covers the major workflows required for defense:

- Authentication and account verification.
- Client inquiry submission and OTP verification.
- Inquiry assignment to lawyers.
- Case lifecycle management.
- Tasks, encrypted documents, and internal notes.
- Staff creation with temporary password visibility.
- Role hierarchy and role-based operations.
- Groups and grouped case access.
- Background email job visibility.

## Implementation Mapping

The local frontend implementation is stored in:

```text
frontend/
```

The running application is available through Docker Compose at:

```text
http://localhost:5173
```

The frontend consumes the real backend API through `/api/*` when running inside Docker Compose.
