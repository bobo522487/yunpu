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

ALTER ROLE auth_runtime WITH LOGIN PASSWORD 'example' NOSUPERUSER NOBYPASSRLS;

GRANT USAGE ON SCHEMA public TO rls_definer;
GRANT USAGE ON SCHEMA public TO auth_runtime;
