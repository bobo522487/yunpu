-- Wave 4A invariants:
-- 1. reflow_lineage_from skips deleted persons (removes FK cascade ordering hazard).
-- 2. refresh_lineage_after_relation_update filters <= 64 branch to lineage parent kinds.
-- 3. Guard owner ⊆ admin invariant in DB trigger (GX013).
-- 4. transfer_organization_ownership locks recipient member row (FOR UPDATE).
-- 5. accept_invite never demotes the organization owner on upsert.
-- 6. Check ancestor cycles immediately so illegal writes fail before lineage reflow.

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
  IF NOT EXISTS (
    SELECT 1 FROM public.person p
     WHERE p.project_id = p_project
       AND p.id = p_child
  ) THEN
    RETURN;
  END IF;

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
        SELECT project_id, to_person_id, kind FROM new_rows
        UNION ALL
        SELECT project_id, to_person_id, kind FROM old_rows
      ) changed
     WHERE kind IN ('biological_parent', 'adoptive_parent', 'ritual_heir')
     GROUP BY project_id, to_person_id
  LOOP
    PERFORM app.reflow_lineage_from(r.project_id, r.to_person_id);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION app.guard_owner_role_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM 'admin' AND EXISTS (
    SELECT 1 FROM public.organization o
     WHERE o.id = NEW.organization_id
       AND o.owner_user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION '不能修改所有者角色' USING ERRCODE = 'GX013';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION app.guard_owner_role_admin() OWNER TO rls_definer;
REVOKE ALL ON FUNCTION app.guard_owner_role_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.guard_owner_role_admin() TO genealogy_app;
GRANT EXECUTE ON FUNCTION app.guard_owner_role_admin() TO rls_definer;

DROP TRIGGER IF EXISTS trg_guard_owner_role_admin ON public.organization_member;
CREATE TRIGGER trg_guard_owner_role_admin
  BEFORE UPDATE OF role ON public.organization_member
  FOR EACH ROW
  WHEN (NEW.role IS DISTINCT FROM 'admin')
  EXECUTE FUNCTION app.guard_owner_role_admin();

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
   WHERE m.organization_id = p_org AND m.user_id = p_new_owner
     FOR UPDATE;

  IF v_role IS NULL THEN
    RAISE EXCEPTION '新 owner 必须是组织成员' USING ERRCODE = 'GX006';
  END IF;

  IF v_role IS DISTINCT FROM 'admin' THEN
    UPDATE public.organization_member m
       SET role = 'admin',
           updated_at = clock_timestamp()
     WHERE m.organization_id = p_org AND m.user_id = p_new_owner;
    IF NOT FOUND THEN
      RAISE EXCEPTION '所有权已被并发请求抢先' USING ERRCODE = 'GX010';
    END IF;
  END IF;

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

CREATE OR REPLACE FUNCTION app.accept_invite(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_user uuid;
  v_hash bytea;
  v_invite_id uuid;
  v_org uuid;
  v_email text;
  v_role text;
  v_status text;
  v_expires timestamptz;
  v_user_email text;
  v_claimed uuid;
BEGIN
  v_user := app.current_user_id();
  IF v_user IS NULL THEN
    RAISE EXCEPTION '缺少已认证用户上下文' USING ERRCODE = 'GX008';
  END IF;

  v_hash := sha256(convert_to(p_token, 'UTF8'));

  SELECT i.id, i.organization_id, i.email, i.role, i.status, i.expires_at
  INTO v_invite_id, v_org, v_email, v_role, v_status, v_expires
  FROM public.invite i
  WHERE i.token_hash = v_hash;

  IF NOT FOUND THEN
    RAISE EXCEPTION '邀请无效或已过期' USING ERRCODE = 'GX005';
  END IF;
  IF v_status = 'accepted' THEN
    RAISE EXCEPTION '邀请已被使用' USING ERRCODE = 'GX010';
  END IF;
  IF v_status = 'revoked' OR v_expires <= now() THEN
    RAISE EXCEPTION '邀请无效或已过期' USING ERRCODE = 'GX005';
  END IF;

  SELECT u.email INTO v_user_email FROM auth."user" u WHERE u.id = v_user;
  IF v_user_email IS DISTINCT FROM v_email THEN
    RAISE EXCEPTION '邀请邮箱与当前用户邮箱不一致' USING ERRCODE = 'GX009';
  END IF;

  UPDATE public.invite
  SET status = 'accepted',
      accepted_at = now(),
      updated_at = clock_timestamp()
  WHERE id = v_invite_id
    AND status = 'pending'
    AND expires_at > now()
  RETURNING id INTO v_claimed;

  IF v_claimed IS NULL THEN
    RAISE EXCEPTION '邀请已被使用' USING ERRCODE = 'GX010';
  END IF;

  INSERT INTO public.organization_member (organization_id, user_id, role, last_used_at)
  VALUES (v_org, v_user, v_role, clock_timestamp())
  ON CONFLICT (organization_id, user_id) DO UPDATE
  SET role = CASE
        WHEN EXISTS (
          SELECT 1 FROM public.organization o
           WHERE o.id = EXCLUDED.organization_id
             AND o.owner_user_id = EXCLUDED.user_id
        ) THEN 'admin'
        ELSE EXCLUDED.role
      END,
      last_used_at = EXCLUDED.last_used_at,
      updated_at = clock_timestamp();

  INSERT INTO public.audit_log (organization_id, project_id, actor_user_id, action, entity_type, entity_id)
  VALUES (v_org, NULL, v_user, 'invite.accepted', 'invite', v_invite_id);

  RETURN v_org;
END;
$$;

ALTER FUNCTION app.accept_invite(text) OWNER TO rls_definer;

DROP TRIGGER IF EXISTS trg_person_relation_no_cycle ON public.person_relation;
CREATE CONSTRAINT TRIGGER trg_person_relation_no_cycle
  AFTER INSERT OR UPDATE ON public.person_relation
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION app.check_ancestor_cycle();
