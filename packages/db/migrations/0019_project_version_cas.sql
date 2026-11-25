-- Project optimistic concurrency: integer version CAS (Wave 3)
ALTER TABLE public.project ADD COLUMN IF NOT EXISTS version integer DEFAULT 1 NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_project_version_positive'
      AND conrelid = 'public.project'::regclass
  ) THEN
    ALTER TABLE public.project ADD CONSTRAINT ck_project_version_positive
      CHECK (version > 0);
  END IF;
END
$$;
