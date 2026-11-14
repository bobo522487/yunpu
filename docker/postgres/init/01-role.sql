-- First init only. The Postgres image runs /docker-entrypoint-initdb.d
-- when the data directory is empty. This file is not a migration.
CREATE ROLE genealogy_app WITH LOGIN PASSWORD 'example' NOSUPERUSER NOBYPASSRLS;
