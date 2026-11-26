-- FR-020 / AC-012：补齐组织协作的四类审计事件。
-- recon 结论：organization.created / invite.accepted / invite.revoked /
-- organization.owner_transferred 已落库，缺口为下列四类，统一用 DB 触发器补齐，
-- 避免绕过 service 的写路径漏审计（plan.md §3 迁移 0024）。
--
-- 风格沿用 app.reject_archived_org_write()（0013_shape_invariants.sql:48-74）：
-- plpgsql + 固定 search_path，仅读触发器行内的 NEW/OLD，不额外查表。
-- 与该函数的差异：本文件四个函数为 SECURITY DEFINER 且 owner = rls_definer，
-- 因为它们要向 FORCE RLS 的 audit_log 追加行；以 rls_definer（BYPASSRLS，0005
-- 已授予 audit_log INSERT）身份执行才能与调用方的可见组织范围无关地稳定落审计。
-- actor 取当前租户会话的 app.user_id（复用 app.current_user_id()）。
-- payload 只写实体 id 与角色枚举；禁止 token / tokenHash / 邮箱 / 会话令牌 / 密码。

-- 1) invite.created：仅记实体 id
CREATE OR REPLACE FUNCTION app.audit_invite_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid := app.current_user_id();
BEGIN
  INSERT INTO public.audit_log
    (organization_id, project_id, actor_user_id, action, entity_type, entity_id, payload)
  VALUES
    (NEW.organization_id, NULL, v_actor, 'invite.created', 'invite', NEW.id,
     jsonb_build_object('id', NEW.id));
  RETURN NEW;
END;
$$;

-- 2) organization_member.role_changed：仅记 from/to 角色枚举
CREATE OR REPLACE FUNCTION app.audit_member_role_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid := app.current_user_id();
BEGIN
  INSERT INTO public.audit_log
    (organization_id, project_id, actor_user_id, action, entity_type, entity_id, payload)
  VALUES
    (NEW.organization_id, NULL, v_actor, 'organization_member.role_changed',
     'organization_member', NEW.user_id,
     jsonb_build_object('from', OLD.role, 'to', NEW.role));
  RETURN NEW;
END;
$$;

-- 3) organization_member.removed：仅记实体 id（user_id）
CREATE OR REPLACE FUNCTION app.audit_member_removed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid := app.current_user_id();
BEGIN
  INSERT INTO public.audit_log
    (organization_id, project_id, actor_user_id, action, entity_type, entity_id, payload)
  VALUES
    (OLD.organization_id, NULL, v_actor, 'organization_member.removed',
     'organization_member', OLD.user_id,
     jsonb_build_object('id', OLD.user_id));
  RETURN OLD;
END;
$$;

-- 4) organization.archived：仅在状态真正变为 archived 时记录，空 payload；改名不触发
CREATE OR REPLACE FUNCTION app.audit_organization_archived()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid := app.current_user_id();
BEGIN
  IF OLD.status <> NEW.status AND NEW.status = 'archived' THEN
    INSERT INTO public.audit_log
      (organization_id, project_id, actor_user_id, action, entity_type, entity_id, payload)
    VALUES
      (NEW.id, NULL, v_actor, 'organization.archived', 'organization', NEW.id,
       '{}'::jsonb);
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION app.audit_invite_created() OWNER TO rls_definer;
ALTER FUNCTION app.audit_member_role_changed() OWNER TO rls_definer;
ALTER FUNCTION app.audit_member_removed() OWNER TO rls_definer;
ALTER FUNCTION app.audit_organization_archived() OWNER TO rls_definer;

REVOKE ALL ON FUNCTION app.audit_invite_created() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.audit_member_role_changed() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.audit_member_removed() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.audit_organization_archived() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app.audit_invite_created() TO genealogy_app;
GRANT EXECUTE ON FUNCTION app.audit_member_role_changed() TO genealogy_app;
GRANT EXECUTE ON FUNCTION app.audit_member_removed() TO genealogy_app;
GRANT EXECUTE ON FUNCTION app.audit_organization_archived() TO genealogy_app;
GRANT EXECUTE ON FUNCTION app.audit_invite_created() TO rls_definer;
GRANT EXECUTE ON FUNCTION app.audit_member_role_changed() TO rls_definer;
GRANT EXECUTE ON FUNCTION app.audit_member_removed() TO rls_definer;
GRANT EXECUTE ON FUNCTION app.audit_organization_archived() TO rls_definer;

CREATE TRIGGER trg_audit_invite_created
  AFTER INSERT ON public.invite
  FOR EACH ROW EXECUTE FUNCTION app.audit_invite_created();

CREATE TRIGGER trg_audit_member_role_changed
  AFTER UPDATE OF role ON public.organization_member
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION app.audit_member_role_changed();

CREATE TRIGGER trg_audit_member_removed
  AFTER DELETE ON public.organization_member
  FOR EACH ROW EXECUTE FUNCTION app.audit_member_removed();

CREATE TRIGGER trg_audit_organization_archived
  AFTER UPDATE OF status ON public.organization
  FOR EACH ROW
  WHEN (OLD.status <> NEW.status AND NEW.status = 'archived')
  EXECUTE FUNCTION app.audit_organization_archived();
