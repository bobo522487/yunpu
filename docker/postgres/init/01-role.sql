-- First init only. The Postgres image runs /docker-entrypoint-initdb.d
-- when the data directory is empty. This file is not a migration.
CREATE ROLE genealogy_app WITH LOGIN PASSWORD 'example' NOSUPERUSER NOBYPASSRLS;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rls_definer') THEN
    CREATE ROLE rls_definer NOLOGIN BYPASSRLS;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auth_runtime') THEN
    CREATE ROLE auth_runtime LOGIN PASSWORD 'example' NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;
