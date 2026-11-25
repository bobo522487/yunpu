-- Applied on top of 0017/0018 for test databases that already ran the
-- original trigger definitions.  Bulky backfills use one set-based rebuild
-- per project; small edits keep the incremental subtree reflow.

CREATE OR REPLACE FUNCTION app.refresh_lineage_after_relation_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  r record;
BEGIN
  IF (SELECT count(*) FROM new_rows
       WHERE kind IN ('biological_parent', 'adoptive_parent', 'ritual_heir')) > 64 THEN
    FOR r IN
      SELECT DISTINCT project_id
        FROM new_rows
       WHERE kind IN ('biological_parent', 'adoptive_parent', 'ritual_heir')
    LOOP
      PERFORM app.rebuild_project_lineage(r.project_id);
    END LOOP;
    RETURN NULL;
  END IF;

  FOR r IN
    SELECT DISTINCT project_id, to_person_id
      FROM new_rows
     WHERE kind IN ('biological_parent', 'adoptive_parent', 'ritual_heir')
  LOOP
    PERFORM app.reflow_lineage_from(r.project_id, r.to_person_id);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION app.refresh_lineage_after_relation_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  r record;
BEGIN
  IF (SELECT count(*) FROM old_rows
       WHERE kind IN ('biological_parent', 'adoptive_parent', 'ritual_heir')) > 64 THEN
    FOR r IN
      SELECT DISTINCT project_id
        FROM old_rows
       WHERE kind IN ('biological_parent', 'adoptive_parent', 'ritual_heir')
    LOOP
      PERFORM app.rebuild_project_lineage(r.project_id);
    END LOOP;
    RETURN NULL;
  END IF;

  FOR r IN
    SELECT DISTINCT project_id, to_person_id
      FROM old_rows
     WHERE kind IN ('biological_parent', 'adoptive_parent', 'ritual_heir')
  LOOP
    PERFORM app.reflow_lineage_from(r.project_id, r.to_person_id);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION app.refresh_lineage_after_relation_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  r record;
BEGIN
  IF (SELECT count(*) FROM (
       SELECT project_id, kind FROM new_rows
       UNION ALL
       SELECT project_id, kind FROM old_rows
     ) changed
     WHERE kind IN ('biological_parent', 'adoptive_parent', 'ritual_heir')) > 64 THEN
    FOR r IN
      SELECT DISTINCT project_id FROM (
        SELECT project_id, kind FROM new_rows
        UNION ALL
        SELECT project_id, kind FROM old_rows
      ) changed
      WHERE kind IN ('biological_parent', 'adoptive_parent', 'ritual_heir')
    LOOP
      PERFORM app.rebuild_project_lineage(r.project_id);
    END LOOP;
    RETURN NULL;
  END IF;

  FOR r IN
    SELECT project_id, to_person_id
      FROM (
        SELECT project_id, to_person_id FROM new_rows
        UNION ALL
        SELECT project_id, to_person_id FROM old_rows
      ) changed
     GROUP BY project_id, to_person_id
  LOOP
    PERFORM app.reflow_lineage_from(r.project_id, r.to_person_id);
  END LOOP;
  RETURN NULL;
END;
$$;
