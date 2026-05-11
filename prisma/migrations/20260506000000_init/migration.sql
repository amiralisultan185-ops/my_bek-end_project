CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'director', 'senior_lawyer', 'lawyer', 'assistant', 'client', 'auditor');

-- CreateEnum
CREATE TYPE "GroupType" AS ENUM ('legal_area', 'branch', 'client_segment', 'review', 'custom');

-- CreateEnum
CREATE TYPE "InquiryCategory" AS ENUM ('family', 'criminal', 'corporate', 'real_estate', 'labor', 'ip', 'other');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('pending_verification', 'new', 'assigned', 'completed', 'archived', 'cancelled');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('active', 'ready_for_review', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('todo', 'in_progress', 'done');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('inquiry_submitted', 'inquiry_cancelled', 'otp_sent', 'otp_failed', 'case_assigned', 'case_reassigned', 'case_ready', 'case_completed', 'case_archived', 'task_created', 'task_updated', 'task_deleted', 'document_uploaded', 'note_added', 'group_created', 'group_member_added', 'case_group_added', 'user_created', 'user_role_changed', 'user_deactivated', 'login_success', 'login_failed');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "hashed_password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "phone" VARCHAR(30),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "permission" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "type" "GroupType" NOT NULL DEFAULT 'custom',
    "description" VARCHAR(500),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_groups" (
    "user_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "assigned_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_groups_pkey" PRIMARY KEY ("user_id","group_id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "jti" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_inquiries" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "category" "InquiryCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "desired_timeline" VARCHAR(200),
    "status" "InquiryStatus" NOT NULL DEFAULT 'pending_verification',
    "email_verified_at" TIMESTAMPTZ(6),
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_otps" (
    "id" UUID NOT NULL,
    "inquiry_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" UUID NOT NULL,
    "inquiry_id" UUID NOT NULL,
    "lawyer_id" UUID NOT NULL,
    "assigned_by" UUID NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_groups" (
    "case_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "assigned_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_groups_pkey" PRIMARY KEY ("case_id","group_id")
);

-- CreateTable
CREATE TABLE "case_history" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "old_lawyer_id" UUID NOT NULL,
    "new_lawyer_id" UUID NOT NULL,
    "changed_by" UUID NOT NULL,
    "reason" VARCHAR(500),
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'todo',
    "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
    "due_date" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "uploader_id" UUID NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "description" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_notes" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" "AuditAction" NOT NULL,
    "resource_type" VARCHAR(50) NOT NULL,
    "resource_id" UUID,
    "metadata" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "ix_users_role_active" ON "users"("role", "is_active");

-- CreateIndex
CREATE INDEX "ix_role_permissions_permission" ON "role_permissions"("permission");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_permission_key" ON "role_permissions"("role", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "groups_slug_key" ON "groups"("slug");

-- CreateIndex
CREATE INDEX "ix_groups_type" ON "groups"("type");

-- CreateIndex
CREATE INDEX "ix_user_groups_group_id" ON "user_groups"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_jti_key" ON "refresh_tokens"("jti");

-- CreateIndex
CREATE INDEX "ix_refresh_tokens_user_id" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "ix_inquiries_status" ON "client_inquiries"("status");

-- CreateIndex
CREATE INDEX "ix_inquiries_category" ON "client_inquiries"("category");

-- CreateIndex
CREATE INDEX "ix_inquiries_created_at" ON "client_inquiries"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "inquiry_otps_inquiry_id_key" ON "inquiry_otps"("inquiry_id");

-- CreateIndex
CREATE INDEX "ix_inquiry_otps_inquiry_id" ON "inquiry_otps"("inquiry_id");

-- CreateIndex
CREATE UNIQUE INDEX "cases_inquiry_id_key" ON "cases"("inquiry_id");

-- CreateIndex
CREATE INDEX "ix_cases_lawyer_id" ON "cases"("lawyer_id");

-- CreateIndex
CREATE INDEX "ix_cases_status" ON "cases"("status");

-- CreateIndex
CREATE INDEX "ix_cases_inquiry_id" ON "cases"("inquiry_id");

-- CreateIndex
CREATE INDEX "ix_cases_last_activity" ON "cases"("last_activity_at");

-- CreateIndex
CREATE INDEX "ix_case_groups_group_id" ON "case_groups"("group_id");

-- CreateIndex
CREATE INDEX "ix_case_history_case_id" ON "case_history"("case_id");

-- CreateIndex
CREATE INDEX "ix_tasks_case_id_status" ON "tasks"("case_id", "status");

-- CreateIndex
CREATE INDEX "ix_documents_case_id" ON "documents"("case_id");

-- CreateIndex
CREATE INDEX "ix_case_notes_case_id" ON "case_notes"("case_id");

-- CreateIndex
CREATE INDEX "ix_audit_user_created" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ix_audit_action" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "ix_audit_resource" ON "audit_logs"("resource_type", "resource_id");

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_otps" ADD CONSTRAINT "inquiry_otps_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "client_inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "client_inquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_lawyer_id_fkey" FOREIGN KEY ("lawyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_groups" ADD CONSTRAINT "case_groups_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_groups" ADD CONSTRAINT "case_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_groups" ADD CONSTRAINT "case_groups_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_history" ADD CONSTRAINT "case_history_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_history" ADD CONSTRAINT "case_history_old_lawyer_id_fkey" FOREIGN KEY ("old_lawyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_history" ADD CONSTRAINT "case_history_new_lawyer_id_fkey" FOREIGN KEY ("new_lawyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_history" ADD CONSTRAINT "case_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_notes" ADD CONSTRAINT "case_notes_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_notes" ADD CONSTRAINT "case_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- SeedRolePermissions
INSERT INTO "role_permissions" ("id", "role", "permission", "description")
VALUES
  (gen_random_uuid(), 'owner', 'users:manage', 'Manage internal users'),
  (gen_random_uuid(), 'owner', 'groups:manage', 'Manage groups and memberships'),
  (gen_random_uuid(), 'owner', 'inquiries:manage', 'Manage client inquiries'),
  (gen_random_uuid(), 'owner', 'cases:read_all', 'Read all cases'),
  (gen_random_uuid(), 'owner', 'cases:assign', 'Assign inquiries to lawyers'),
  (gen_random_uuid(), 'owner', 'cases:reassign', 'Reassign cases'),
  (gen_random_uuid(), 'owner', 'cases:complete', 'Complete or reopen cases'),
  (gen_random_uuid(), 'owner', 'owner:create', 'Create additional owners'),

  (gen_random_uuid(), 'director', 'users:manage', 'Manage internal users'),
  (gen_random_uuid(), 'director', 'groups:manage', 'Manage groups and memberships'),
  (gen_random_uuid(), 'director', 'inquiries:manage', 'Manage client inquiries'),
  (gen_random_uuid(), 'director', 'cases:read_all', 'Read all cases'),
  (gen_random_uuid(), 'director', 'cases:assign', 'Assign inquiries to lawyers'),
  (gen_random_uuid(), 'director', 'cases:reassign', 'Reassign cases'),
  (gen_random_uuid(), 'director', 'cases:complete', 'Complete or reopen cases'),

  (gen_random_uuid(), 'senior_lawyer', 'cases:read_assigned', 'Read assigned cases'),
  (gen_random_uuid(), 'senior_lawyer', 'cases:work_assigned', 'Work on assigned cases'),
  (gen_random_uuid(), 'senior_lawyer', 'cases:submit_review', 'Submit assigned case for review'),

  (gen_random_uuid(), 'lawyer', 'cases:read_assigned', 'Read assigned cases'),
  (gen_random_uuid(), 'lawyer', 'cases:work_assigned', 'Work on assigned cases'),
  (gen_random_uuid(), 'lawyer', 'cases:submit_review', 'Submit assigned case for review'),

  (gen_random_uuid(), 'assistant', 'cases:read_group', 'Read cases linked to assistant groups'),
  (gen_random_uuid(), 'assistant', 'cases:assist_group', 'Assist on cases linked to assistant groups'),

  (gen_random_uuid(), 'auditor', 'cases:read_group', 'Read cases linked to auditor groups')
ON CONFLICT ("role", "permission") DO NOTHING;


