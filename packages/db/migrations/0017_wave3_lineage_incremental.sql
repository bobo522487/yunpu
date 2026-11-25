-- Wave 3: public.ltree-based incremental lineage projection.
-- Replaces per-project full rebuild on relation writes with subtree reflows,
-- and removes the silent 64-generation truncation.

CREATE OR REPLACE FUNCTION app.lineage_label(p_person uuid)
RETURNS public.ltree
LANGUAGE sql IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT replace(p_person::text, '-', '')::public.ltree
$$;

CREATE OR REPLACE FUNCTION app.lineage_primary_parent(p_project uuid, p_child uuid)
RETURNS uuid
LANGUAGE sql STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT r.from_person_id
    FROM public.person_relation r
   WHERE r.project_id = p_project
     AND r.to_person_id = p_child
     AND r.kind IN ('biological_parent', 'adoptive_parent', 'ritual_heir')
   ORDER BY CASE r.kind
              WHEN 'biological_parent' THEN 0
              WHEN 'adoptive_parent' THEN 1
              ELSE 2
            END,
            r.from_person_id
   LIMIT 1
$$;

-- Move p_person and every projected descendant from the old public.ltree prefix to
-- the new one.  Only rows whose materialized value actually changes are
-- written, so replaying the same edge does not churn WAL.
CREATE OR REPLACE FUNCTION app.shift_lineage_subtree(
  p_project uuid,
  p_person uuid,
  p_old_path public.ltree,
  p_old_generation integer,
  p_new_path public.ltree,
  p_new_generation integer
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF p_new_path IS NOT DISTINCT FROM p_old_path
     AND p_new_generation IS NOT DISTINCT FROM p_old_generation THEN
    RETURN;
  END IF;

  IF p_old_path IS NULL THEN
    SELECT organization_id INTO v_org
      FROM public.project
     WHERE id = p_project;
    IF v_org IS NULL THEN
      RETURN;
    END IF;

    INSERT INTO public.lineage_projection AS lp
      (organization_id, project_id, person_id, primary_path, generation, updated_at)
    VALUES
      (v_org, p_project, p_person, p_new_path, p_new_generation, clock_timestamp())
    ON CONFLICT (project_id, person_id) DO UPDATE
       SET primary_path = EXCLUDED.primary_path,
           generation = EXCLUDED.generation,
           updated_at = clock_timestamp()
     WHERE lp.primary_path IS DISTINCT FROM EXCLUDED.primary_path
        OR lp.generation IS DISTINCT FROM EXCLUDED.generation;
    RETURN;
  END IF;

  UPDATE public.lineage_projection AS lp
     SET primary_path = CASE
           WHEN lp.person_id = p_person THEN p_new_path
           ELSE p_new_path || subpath(
             lp.primary_path,
             nlevel(p_old_path),
             nlevel(lp.primary_path) - nlevel(p_old_path)
           )
         END,
         generation = CASE
           WHEN lp.person_id = p_person THEN p_new_generation
           ELSE lp.generation + (p_new_generation - p_old_generation)
         END,
         updated_at = clock_timestamp()
   WHERE lp.project_id = p_project
     AND (
       lp.primary_path::text = p_old_path::text
       OR lp.primary_path::text LIKE p_old_path::text || '.%'
     )
     AND (
       lp.primary_path IS DISTINCT FROM CASE
         WHEN lp.person_id = p_person THEN p_new_path
         ELSE p_new_path || subpath(
           lp.primary_path,
           nlevel(p_old_path),
           nlevel(lp.primary_path) - nlevel(p_old_path)
         )
       END
       OR lp.generation IS DISTINCT FROM CASE
         WHEN lp.person_id = p_person THEN p_new_generation
         ELSE lp.generation + (p_new_generation - p_old_generation)
       END
     );
END;
$$;

-- Reflow the subtree rooted at p_child after its primary-parent link changed.
-- Every Person is projected as a root on insert, so the primary parent already
-- has a current path in the common case; only that one subtree needs a shift.
CREATE OR REPLACE FUNCTION app.reflow_lineage_from(p_project uuid, p_child uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_parent uuid;
  v_path public.ltree;
  v_generation integer;
  v_old_path public.ltree;
  v_old_generation integer;
BEGIN
  v_parent := app.lineage_primary_parent(p_project, p_child);

  IF v_parent IS NULL THEN
    SELECT lp.primary_path, lp.generation
      INTO v_old_path, v_old_generation
      FROM public.lineage_projection lp
     WHERE lp.project_id = p_project
       AND lp.person_id = p_child;

    PERFORM app.shift_lineage_subtree(
      p_project,
      p_child,
      v_old_path,
      v_old_generation,
      app.lineage_label(p_child),
      0
    );
    RETURN;
  END IF;

  SELECT lp.primary_path, lp.generation
    INTO v_path, v_generation
    FROM public.lineage_projection lp
   WHERE lp.project_id = p_project
     AND lp.person_id = v_parent;

  -- Backfilled data may predate the per-Person projection trigger.
  IF NOT FOUND THEN
    PERFORM app.rebuild_project_lineage(p_project);
    RETURN;
  END IF;

  SELECT lp.primary_path, lp.generation
    INTO v_old_path, v_old_generation
    FROM public.lineage_projection lp
   WHERE lp.project_id = p_project
     AND lp.person_id = p_child;

  PERFORM app.shift_lineage_subtree(
    p_project,
    p_child,
    v_old_path,
    v_old_generation,
    v_path || app.lineage_label(p_child),
    v_generation + 1
  );
END;
$$;

-- Project every newly created Person as a root; a later lineage edge reflows
-- that subtree instead of forcing a whole-project rebuild.
CREATE OR REPLACE FUNCTION app.lineage_projection_after_person_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO public.lineage_projection AS lp
    (organization_id, project_id, person_id, primary_path, generation, updated_at)
  VALUES
    (NEW.organization_id, NEW.project_id, NEW.id, app.lineage_label(NEW.id), 0, clock_timestamp())
  ON CONFLICT (project_id, person_id) DO NOTHING;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_lineage_projection_person_insert ON public.person;
CREATE TRIGGER trg_lineage_projection_person_insert
  AFTER INSERT ON public.person
  FOR EACH ROW EXECUTE FUNCTION app.lineage_projection_after_person_insert();

-- Keep the explicit full rebuild for backfills and repair, but make it
-- public.ltree-cycle-safe and unbounded (no silent 64-generation cutoff).
CREATE OR REPLACE FUNCTION app.rebuild_project_lineage(p_project uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT organization_id INTO v_org
    FROM public.project
   WHERE id = p_project;
  IF v_org IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.lineage_projection AS lp
    (organization_id, project_id, person_id, primary_path, generation, updated_at)
  WITH RECURSIVE ranked_parent AS (
    SELECT DISTINCT ON (r.to_person_id)
           r.to_person_id AS person_id,
           r.from_person_id AS parent_id
      FROM public.person_relation r
     WHERE r.project_id = p_project
       AND r.kind IN ('biological_parent', 'adoptive_parent', 'ritual_heir')
     ORDER BY r.to_person_id,
              CASE r.kind
                WHEN 'biological_parent' THEN 0
                WHEN 'adoptive_parent' THEN 1
                ELSE 2
              END,
              r.from_person_id
  ),
  rebuilt AS (
    SELECT p.id AS person_id,
           app.lineage_label(p.id) AS primary_path,
           0 AS generation
      FROM public.person p
     WHERE p.project_id = p_project
       AND NOT EXISTS (
         SELECT 1 FROM ranked_parent rp WHERE rp.person_id = p.id
       )
    UNION ALL
    SELECT rp.person_id,
           (b.primary_path || app.lineage_label(rp.person_id)),
           b.generation + 1
      FROM ranked_parent rp
      JOIN rebuilt b ON b.person_id = rp.parent_id
     WHERE NOT (b.primary_path @> app.lineage_label(rp.person_id))
  )
  SELECT v_org, p_project, r.person_id, r.primary_path, r.generation, clock_timestamp()
    FROM rebuilt r
  ON CONFLICT (project_id, person_id) DO UPDATE
     SET primary_path = EXCLUDED.primary_path,
         generation = EXCLUDED.generation,
         updated_at = clock_timestamp()
   WHERE lp.primary_path IS DISTINCT FROM EXCLUDED.primary_path
      OR lp.generation IS DISTINCT FROM EXCLUDED.generation;
END;
$$;

CREATE OR REPLACE FUNCTION app.refresh_lineage_after_relation_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  r record;
BEGIN
  -- Bulk inserts are common in backfills; reflowing every row individually
  -- costs far more than one set-based projection rebuild.
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

GRANT EXECUTE ON FUNCTION app.lineage_label(uuid) TO genealogy_app;
GRANT EXECUTE ON FUNCTION app.lineage_primary_parent(uuid, uuid) TO genealogy_app;
GRANT EXECUTE ON FUNCTION app.shift_lineage_subtree(uuid, uuid, public.ltree, integer, public.ltree, integer) TO genealogy_app;
GRANT EXECUTE ON FUNCTION app.reflow_lineage_from(uuid, uuid) TO genealogy_app;
GRANT EXECUTE ON FUNCTION app.rebuild_project_lineage(uuid) TO genealogy_app;
