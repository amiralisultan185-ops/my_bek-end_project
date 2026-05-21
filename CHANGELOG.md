# Changelog

## Final defense readiness

- Added a Docker-served frontend application under `frontend/`.
- Kept backend endpoints aligned with `openapi.yaml`.
- Documented Prisma migrations under `prisma/migrations/`; the top-level `migrations/` directory points to the executable Prisma history.
- Added encrypted document storage using AES-256-GCM and SHA-256 integrity hashes.
- Added Redis-backed email job visibility through `/jobs/email` and `/jobs/email/{job_id}`.
- No intentional API deviations from `openapi.yaml` are currently known.
