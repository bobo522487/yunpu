-- Wave 1 / P0 invariants. Applied once by packages/db/src/migrate.ts.
-- 1. Every write that can change lineage holds the per-project advisory lock.
-- 2. An unchanged lineage rebuild must not create a new row version.
-- 3. Ownership transfer must keep owner ⊆ admin and refuse non-active orgs.

-- P0-1a: the statement-level refresh runs for DELETE and for kind downgrades,
-- so the row-level lock must cover exactly those cases too. -------------------
CREATE OR REPLACE FUNCTION app.lock_relation_lineage_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_project uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF app.relation_kind_is_lineage_parent(OLD.kind) THEN
      v_project := OLD.project_id;
    END IF;
  ELSE
    IF app.relation_kind_is_lineage_parent(NEW.kind)
       OR (TG_OP = 'UPDATE' AND app.relation_kind_is_lineage_parent(OLD.kind)) THEN
      v_project := NEW.project_id;
    END IF;
  END IF;

  IF v_project IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended('yunpu:relation:' || v_project::text, 0)
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_person_relation_lock ON public.person_relation;
CREATE TRIGGER trg_person_relation_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.person_relation
  FOR EACH ROW EXECUTE FUNCTION app.lock_relation_lineage_write();

-- P0-1a: never rewrite an identical projection row (WAL / dead-tuple bloat). --
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
        updated_at = clock_timestamp()
  WHERE lp.primary_path IS DISTINCT FROM EXCLUDED.primary_path
     OR lp.generation IS DISTINCT FROM EXCLUDED.generation;
END;
$$;

-- P0-3: close owner ⊆ admin and the archived-org write ban at the data layer. --
CREATE OR REPLACE FUNCTION app.transfer_organization_ownership(p_org uuid, p_new_owner uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid := app.current_user_id();
  v_prev uuid;
  v_status text;
  v_role text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION '请求缺少认证上下文' USING ERRCODE = 'GX008';
  END IF;

  SELECT o.owner_user_id, o.status INTO v_prev, v_status
    FROM public.organization o
   WHERE o.id = p_org;

  IF NOT FOUND THEN
    RAISE EXCEPTION '目标不存在或已失效' USING ERRCODE = 'GX005';
  END IF;

  IF v_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION '组织已归档，无法写入' USING ERRCODE = 'GX012';
  END IF;

  IF v_prev IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION '只有组织 owner 可以转移所有权' USING ERRCODE = 'GX006';
  END IF;

  SELECT m.role INTO v_role
    FROM public.organization_member m
   WHERE m.organization_id = p_org AND m.user_id = p_new_owner;

  IF v_role IS NULL THEN
    RAISE EXCEPTION '新 owner 必须是组织成员' USING ERRCODE = 'GX006';
  END IF;

  -- A viewer owner would immediately be locked out by the admin-only RLS
  -- policies, so promote inside the same transaction instead.
  IF v_role IS DISTINCT FROM 'admin' THEN
    UPDATE public.organization_member m
       SET role = 'admin',
           updated_at = clock_timestamp()
     WHERE m.organization_id = p_org AND m.user_id = p_new_owner;
    IF NOT FOUND THEN
      RAISE EXCEPTION '所有权已被并发请求抢先' USING ERRCODE = 'GX010';
    END IF;
  END IF;

  -- CAS: validation and write are one atomic statement; only one racer wins.
  UPDATE public.organization
     SET owner_user_id = p_new_owner,
         updated_at = clock_timestamp()
   WHERE id = p_org
     AND owner_user_id = v_prev;

  IF NOT FOUND THEN
    RAISE EXCEPTION '所有权已被并发转移' USING ERRCODE = 'GX010';
  END IF;

  INSERT INTO public.audit_log
    (organization_id, project_id, actor_user_id, action, entity_type, entity_id, payload)
  VALUES
    (p_org, NULL, v_actor, 'organization.owner_transferred', 'organization', p_org,
     jsonb_build_object(
       'from', v_prev,
       'to', p_new_owner,
       'promoted_to_admin', v_role IS DISTINCT FROM 'admin'
     ));
END;
$$;

ALTER FUNCTION app.transfer_organization_ownership(uuid, uuid) OWNER TO rls_definer;
