ALTER TABLE "client_inquiries"
  ADD COLUMN "client_user_id" UUID;

CREATE INDEX "ix_inquiries_client_user_id" ON "client_inquiries"("client_user_id");

ALTER TABLE "client_inquiries"
  ADD CONSTRAINT "client_inquiries_client_user_id_fkey"
  FOREIGN KEY ("client_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
