-- Custom additive migration: preserves all notification and delivery history.
-- Existing custom migrations have stale generator snapshots; do not replay their old tables.
ALTER TABLE "notifications"
  ADD COLUMN "email_claim_id" uuid,
  ADD COLUMN "email_claimed_at" timestamptz,
  ADD COLUMN "email_first_attempt_at" timestamptz,
  ADD COLUMN "email_retry_safe" boolean DEFAULT false NOT NULL,
  ADD COLUMN "email_payload" jsonb;
