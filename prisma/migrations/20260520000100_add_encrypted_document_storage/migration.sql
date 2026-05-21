ALTER TABLE "documents"
  ADD COLUMN IF NOT EXISTS "sha256_hash" CHAR(64),
  ADD COLUMN IF NOT EXISTS "encryption_algorithm" VARCHAR(40) NOT NULL DEFAULT 'AES-256-GCM',
  ADD COLUMN IF NOT EXISTS "encryption_iv" BYTEA,
  ADD COLUMN IF NOT EXISTS "encryption_tag" BYTEA,
  ADD COLUMN IF NOT EXISTS "encrypted_data" BYTEA;

CREATE INDEX IF NOT EXISTS "ix_documents_sha256_hash" ON "documents"("sha256_hash");
