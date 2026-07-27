-- Social login (Google web + iOS, Apple iOS) and the lead-magnet leads table.
--
-- Idempotent and non-destructive: safe to re-run.
--
-- NOTE: apply this with psql, NOT `drizzle-kit push`. Adding the UNIQUE
-- constraints via push prompts to truncate the tutors table, which would
-- destroy live tutor records.
--
--   docker exec -i sgtutors-pg psql -U postgres -d sgtutors \
--     < server/migrations/001-social-login-and-leads.sql

BEGIN;

-- Provider subject ids. Internal only — never exposed by the public API.
ALTER TABLE tutors ADD COLUMN IF NOT EXISTS google_sub text;
ALTER TABLE tutors ADD COLUMN IF NOT EXISTS apple_sub  text;

-- Social-only accounts never set a password.
ALTER TABLE tutors ALTER COLUMN password_hash DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tutors_google_sub_unique') THEN
    ALTER TABLE tutors ADD CONSTRAINT tutors_google_sub_unique UNIQUE (google_sub);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tutors_apple_sub_unique') THEN
    ALTER TABLE tutors ADD CONSTRAINT tutors_apple_sub_unique UNIQUE (apple_sub);
  END IF;
END $$;

-- Marketing leads from the tuition rate guide.
-- PDPA: consent recorded with a timestamp; unsubscribes are kept as a
-- withdrawal record rather than deleted, so a re-import can't undo them.
CREATE TABLE IF NOT EXISTS leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL UNIQUE,
  source          text NOT NULL DEFAULT 'rate-guide',
  consent         boolean NOT NULL DEFAULT false,
  consent_at      timestamptz,
  ip_hash         text,
  unsubscribed_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leads_created_idx ON leads (created_at);

COMMIT;
