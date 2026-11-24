-- Life years, parent cardinality, archived-org writes, lineage refresh, project FK indexes.

ALTER TABLE public.person
  ADD CONSTRAINT ck_person_life_years
  CHECK (
    (death_year IS NULL OR is_living = false)
    AND (birth_year IS NULL OR death_year IS NULL OR death_year >= birth_year)
  );

CREATE INDEX idx_person_org_project
  ON public.person (organization_id, project_id);
CREATE INDEX idx_person_name_org_project
  ON public.person_name (organization_id, project_id);
CREATE INDEX idx_person_relation_org_project
  ON public.person_relation (organization_id, project_id);
CREATE INDEX idx_lineage_projection_org_project
  ON public.lineage_projection (organization_id, project_id);

CREATE OR REPLACE FUNCTION app.enforce_parent_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  n integer;
BEGIN
  IF NEW.kind NOT IN ('biological_parent', 'adoptive_parent') THEN
    RETURN NEW;
  END IF;
  SELECT count(*)::integer INTO n
    FROM public.person_relation r
   WHERE r.project_id = NEW.project_id
     AND r.to_person_id = NEW.to_person_id
     AND r.kind = NEW.kind;
  IF n > 2 THEN
    RAISE EXCEPTION 'parent limit'
      USING ERRCODE = 'GX011';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_person_relation_parent_limit
  AFTER INSERT OR UPDATE OF to_person_id, kind ON public.person_relation
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION app.enforce_parent_limit();

CREATE OR REPLACE FUNCTION app.reject_archived_org_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  v_org uuid;
  v_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_org := OLD.organization_id;
  ELSE
    v_org := NEW.organization_id;
  END IF;
  SELECT o.status INTO v_status
    FROM public.organization o
   WHERE o.id = v_org;
  IF v_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION '组织已归档，无法写入'
      USING ERRCODE = 'GX012';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reject_archived_org_project
  BEFORE INSERT OR UPDATE OR DELETE ON public.project
  FOR EACH ROW EXECUTE FUNCTION app.reject_archived_org_write();
CREATE TRIGGER trg_reject_archived_org_person
  BEFORE INSERT OR UPDATE OR DELETE ON public.person
  FOR EACH ROW EXECUTE FUNCTION app.reject_archived_org_write();
CREATE TRIGGER trg_reject_archived_org_person_name
  BEFORE INSERT OR UPDATE OR DELETE ON public.person_name
  FOR EACH ROW EXECUTE FUNCTION app.reject_archived_org_write();
CREATE TRIGGER trg_reject_archived_org_person_relation
  BEFORE INSERT OR UPDATE OR DELETE ON public.person_relation
  FOR EACH ROW EXECUTE FUNCTION app.reject_archived_org_write();
CREATE TRIGGER trg_reject_archived_org_lineage_projection
  BEFORE INSERT OR UPDATE OR DELETE ON public.lineage_projection
  FOR EACH ROW EXECUTE FUNCTION app.reject_archived_org_write();
CREATE TRIGGER trg_reject_archived_org_member
  BEFORE INSERT OR UPDATE OR DELETE ON public.organization_member
  FOR EACH ROW EXECUTE FUNCTION app.reject_archived_org_write();
CREATE TRIGGER trg_reject_archived_org_invite
  BEFORE INSERT OR UPDATE OR DELETE ON public.invite
  FOR EACH ROW EXECUTE FUNCTION app.reject_archived_org_write();

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
           replace(p.id::text, '-', '')::ltree AS primary_path,
           0 AS generation
      FROM public.person p
     WHERE p.project_id = p_project
       AND NOT EXISTS (
         SELECT 1 FROM ranked_parent rp WHERE rp.person_id = p.id
       )
    UNION ALL
    SELECT rp.person_id,
           (b.primary_path || replace(rp.person_id::text, '-', ''))::ltree,
           b.generation + 1
      FROM ranked_parent rp
      JOIN rebuilt b ON b.person_id = rp.parent_id
     WHERE b.generation < 64
       AND strpos(b.primary_path::text, replace(rp.person_id::text, '-', '')) = 0
  )
  SELECT v_org, p_project, r.person_id, r.primary_path, r.generation, clock_timestamp()
    FROM rebuilt r
  ON CONFLICT (project_id, person_id) DO UPDATE
    SET primary_path = EXCLUDED.primary_path,
        generation = EXCLUDED.generation,
        updated_at = clock_timestamp();
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
  FOR r IN
    SELECT DISTINCT project_id
      FROM new_rows
     WHERE kind IN ('biological_parent', 'adoptive_parent', 'ritual_heir')
  LOOP
    PERFORM app.rebuild_project_lineage(r.project_id);
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
  FOR r IN
    SELECT DISTINCT project_id
      FROM old_rows
     WHERE kind IN ('biological_parent', 'adoptive_parent', 'ritual_heir')
  LOOP
    PERFORM app.rebuild_project_lineage(r.project_id);
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
  FOR r IN
    SELECT project_id FROM (
      SELECT project_id, kind FROM new_rows
      UNION ALL
      SELECT project_id, kind FROM old_rows
    ) changed
    WHERE kind IN ('biological_parent', 'adoptive_parent', 'ritual_heir')
    GROUP BY project_id
  LOOP
    PERFORM app.rebuild_project_lineage(r.project_id);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_lineage_refresh_insert
  AFTER INSERT ON public.person_relation
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION app.refresh_lineage_after_relation_insert();

CREATE TRIGGER trg_lineage_refresh_delete
  AFTER DELETE ON public.person_relation
  REFERENCING OLD TABLE AS old_rows
  FOR EACH STATEMENT EXECUTE FUNCTION app.refresh_lineage_after_relation_delete();

CREATE TRIGGER trg_lineage_refresh_update
  AFTER UPDATE ON public.person_relation
  REFERENCING NEW TABLE AS new_rows OLD TABLE AS old_rows
  FOR EACH STATEMENT EXECUTE FUNCTION app.refresh_lineage_after_relation_update();

GRANT EXECUTE ON FUNCTION app.rebuild_project_lineage(uuid) TO genealogy_app;
GRANT EXECUTE ON FUNCTION app.enforce_parent_limit() TO genealogy_app;
GRANT EXECUTE ON FUNCTION app.reject_archived_org_write() TO genealogy_app;
