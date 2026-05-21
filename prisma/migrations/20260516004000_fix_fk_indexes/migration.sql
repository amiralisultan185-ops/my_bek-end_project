-- Add missing indexes for foreign keys that are used in joins, deletes, and access checks.
CREATE INDEX IF NOT EXISTS "ix_groups_created_by" ON "groups"("created_by");
CREATE INDEX IF NOT EXISTS "ix_user_groups_assigned_by" ON "user_groups"("assigned_by");
CREATE INDEX IF NOT EXISTS "ix_inquiries_email" ON "client_inquiries"("email");
CREATE INDEX IF NOT EXISTS "ix_cases_assigned_by" ON "cases"("assigned_by");
CREATE INDEX IF NOT EXISTS "ix_case_groups_assigned_by" ON "case_groups"("assigned_by");
CREATE INDEX IF NOT EXISTS "ix_case_history_old_lawyer_id" ON "case_history"("old_lawyer_id");
CREATE INDEX IF NOT EXISTS "ix_case_history_new_lawyer_id" ON "case_history"("new_lawyer_id");
CREATE INDEX IF NOT EXISTS "ix_case_history_changed_by" ON "case_history"("changed_by");
CREATE INDEX IF NOT EXISTS "ix_tasks_created_by" ON "tasks"("created_by");
CREATE INDEX IF NOT EXISTS "ix_documents_uploader_id" ON "documents"("uploader_id");
CREATE INDEX IF NOT EXISTS "ix_case_notes_author_id" ON "case_notes"("author_id");

-- Remove duplicate indexes where an existing UNIQUE index already covers the same column.
DROP INDEX IF EXISTS "ix_inquiry_otps_inquiry_id";
DROP INDEX IF EXISTS "ix_cases_inquiry_id";
