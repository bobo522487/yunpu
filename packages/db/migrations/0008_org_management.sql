-- 成员列表需要展示姓名与邮箱（列级最小授权；矩阵见 security.md §8.4）
GRANT SELECT (id, email, name) ON auth."user" TO genealogy_app;

-- 撤销邀请：invite 的所有状态变更的唯一入口（schema.md §5.3 v1.2 / §9.3）
CREATE OR REPLACE FUNCTION app.revoke_invite(p_invite_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid := app.current_user_id();
  v_org uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION '请求缺少认证上下文' USING ERRCODE = 'GX008';
  END IF;

  SELECT organization_id INTO v_org
    FROM public.invite
   WHERE id = p_invite_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '邀请不存在或已不是待处理状态' USING ERRCODE = 'GX005';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_member
     WHERE organization_id = v_org AND user_id = v_actor AND role = 'admin'
  ) THEN
    RAISE EXCEPTION '无权撤销邀请' USING ERRCODE = 'GX006';
  END IF;

  UPDATE public.invite
     SET status = 'revoked',
         revoked_at = now(),
         updated_at = clock_timestamp()
   WHERE id = p_invite_id
     AND status = 'pending'
     AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION '邀请不存在或已不是待处理状态' USING ERRCODE = 'GX005';
  END IF;

  INSERT INTO public.audit_log
    (organization_id, project_id, actor_user_id, action, entity_type, entity_id, payload)
  VALUES
    (v_org, NULL, v_actor, 'invite.revoked', 'invite', p_invite_id,
     jsonb_build_object('reason', COALESCE(p_reason, '')));
END;
$$;

-- 所有权转移：CAS 条件更新 + 强审计（schema.md §9.3 v1.2）
CREATE OR REPLACE FUNCTION app.transfer_organization_ownership(p_org uuid, p_new_owner uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid := app.current_user_id();
  v_prev uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION '请求缺少认证上下文' USING ERRCODE = 'GX008';
  END IF;

  SELECT owner_user_id INTO v_prev
    FROM public.organization
   WHERE id = p_org;

  IF NOT FOUND THEN
    RAISE EXCEPTION '目标不存在或已失效' USING ERRCODE = 'GX005';
  END IF;

  IF v_prev IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION '只有组织 owner 可以转移所有权' USING ERRCODE = 'GX006';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_member
     WHERE organization_id = p_org AND user_id = p_new_owner
  ) THEN
    RAISE EXCEPTION '新 owner 必须是组织成员' USING ERRCODE = 'GX006';
  END IF;

  -- CAS：校验与写入合并为一条原子语句；并发下只有一个事务能命中
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
     jsonb_build_object('from', v_prev, 'to', p_new_owner));
END;
$$;

ALTER FUNCTION app.revoke_invite(uuid, text) OWNER TO rls_definer;
ALTER FUNCTION app.transfer_organization_ownership(uuid, uuid) OWNER TO rls_definer;

REVOKE ALL ON FUNCTION app.revoke_invite(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.transfer_organization_ownership(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app.revoke_invite(uuid, text) TO genealogy_app;
GRANT EXECUTE ON FUNCTION app.transfer_organization_ownership(uuid, uuid) TO genealogy_app;
