ALTER TABLE "consultation_note_sources"
  ADD COLUMN "template" text DEFAULT 'generic' NOT NULL;

ALTER TABLE "consultation_notes"
  ADD COLUMN "details" jsonb DEFAULT '{}'::jsonb NOT NULL;

ALTER TABLE "consultation_note_revisions"
  ADD COLUMN "details" jsonb DEFAULT '{}'::jsonb NOT NULL;

UPDATE "consultation_note_sources"
SET "template" = CASE lower("name")
  WHEN 'email' THEN 'email'
  WHEN 'whatsapp' THEN 'reference'
  WHEN 'sketch reference' THEN 'reference'
  WHEN 'colour reference' THEN 'colour'
  ELSE 'generic'
END;

ALTER TABLE "consultation_note_sources"
  ADD CONSTRAINT "consultation_note_sources_template_check"
  CHECK ("template" IN ('generic', 'email', 'reference', 'colour'));
