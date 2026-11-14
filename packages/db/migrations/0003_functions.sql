CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog
AS $$
DECLARE
  v_raw text;
BEGIN
  v_raw := NULLIF(current_setting('app.user_id', true), '');
  IF v_raw IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN v_raw::uuid;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION app.visible_org_array()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT COALESCE(array_agg(om.organization_id), '{}'::uuid[])
  FROM public.organization_member om
  WHERE om.user_id = app.current_user_id()
$$;

CREATE OR REPLACE FUNCTION app.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.guard_scope_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (to_jsonb(NEW) ->> 'organization_id') IS DISTINCT FROM (to_jsonb(OLD) ->> 'organization_id')
     OR (to_jsonb(NEW) ->> 'project_id') IS DISTINCT FROM (to_jsonb(OLD) ->> 'project_id') THEN
    RAISE EXCEPTION 'scope 不可迁移：organization_id / project_id 创建后不可修改'
      USING ERRCODE = 'GX002';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.guard_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '审计日志只可追加' USING ERRCODE = 'GX004';
END;
$$;

CREATE OR REPLACE FUNCTION app.create_organization(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_user uuid;
  v_org uuid;
BEGIN
  v_user := app.current_user_id();
  IF v_user IS NULL THEN
    RAISE EXCEPTION '创建组织缺少已认证用户上下文' USING ERRCODE = 'GX008';
  END IF;
  IF btrim(p_name) = '' THEN
    RAISE EXCEPTION '组织名不能为空' USING ERRCODE = '23514';
  END IF;

  SET CONSTRAINTS public.fk_organization_owner DEFERRED;

  INSERT INTO public.organization (name, status, owner_user_id)
  VALUES (btrim(p_name), 'active', v_user)
  RETURNING id INTO v_org;

  INSERT INTO public.organization_member (organization_id, user_id, role, last_used_at)
  VALUES (v_org, v_user, 'admin', clock_timestamp());

  INSERT INTO public.audit_log (organization_id, project_id, actor_user_id, action, entity_type, entity_id)
  VALUES (v_org, NULL, v_user, 'organization.created', 'organization', v_org);

  RETURN v_org;
END;
$$;

CREATE OR REPLACE FUNCTION app.resolve_invite_by_token(p_token text)
RETURNS TABLE (invite_id uuid, organization_id uuid, email text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_hash bytea;
BEGIN
  v_hash := sha256(convert_to(p_token, 'UTF8'));

  RETURN QUERY
    SELECT i.id, i.organization_id, i.email, i.role
    FROM public.invite i
    WHERE i.token_hash = v_hash
      AND i.status = 'pending'
      AND i.expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION '邀请无效或已过期' USING ERRCODE = 'GX005';
  END IF;
END;
$$;

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
  SET role = EXCLUDED.role,
      last_used_at = EXCLUDED.last_used_at,
      updated_at = clock_timestamp();

  INSERT INTO public.audit_log (organization_id, project_id, actor_user_id, action, entity_type, entity_id)
  VALUES (v_org, NULL, v_user, 'invite.accepted', 'invite', v_invite_id);

  RETURN v_org;
END;
$$;

ALTER FUNCTION app.visible_org_array() OWNER TO rls_definer;
ALTER FUNCTION app.create_organization(text) OWNER TO rls_definer;
ALTER FUNCTION app.resolve_invite_by_token(text) OWNER TO rls_definer;
ALTER FUNCTION app.accept_invite(text) OWNER TO rls_definer;

REVOKE ALL ON FUNCTION app.current_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.visible_org_array() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.create_organization(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.resolve_invite_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.accept_invite(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app.current_user_id() TO genealogy_app;
GRANT EXECUTE ON FUNCTION app.current_user_id() TO rls_definer;
GRANT EXECUTE ON FUNCTION app.visible_org_array() TO genealogy_app;
GRANT EXECUTE ON FUNCTION app.create_organization(text) TO genealogy_app;
GRANT EXECUTE ON FUNCTION app.resolve_invite_by_token(text) TO genealogy_app;
GRANT EXECUTE ON FUNCTION app.accept_invite(text) TO genealogy_app;

CREATE TRIGGER trg_touch_updated_at
  BEFORE UPDATE ON public.organization
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER trg_touch_updated_at
  BEFORE UPDATE ON public.organization_member
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER trg_touch_updated_at
  BEFORE UPDATE ON public.invite
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER trg_guard_scope_immutable
  BEFORE UPDATE ON public.organization_member
  FOR EACH ROW EXECUTE FUNCTION app.guard_scope_immutable();

CREATE TRIGGER trg_guard_scope_immutable
  BEFORE UPDATE ON public.invite
  FOR EACH ROW EXECUTE FUNCTION app.guard_scope_immutable();

CREATE TRIGGER trg_audit_log_append_only
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION app.guard_append_only();
