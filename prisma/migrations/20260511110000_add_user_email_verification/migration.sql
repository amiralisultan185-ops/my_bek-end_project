ALTER TABLE "users"
  ADD COLUMN "email_verified_at" TIMESTAMPTZ(6);

UPDATE "users"
SET "email_verified_at" = CURRENT_TIMESTAMP
WHERE "email_verified_at" IS NULL;
