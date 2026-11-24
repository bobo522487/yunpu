-- Role backstop for writes. SELECT policies stay "members see their orgs".

CREATE OR REPLACE FUNCTION app.member_role(p_org uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT om.role
    FROM public.organization_member om
   WHERE om.organization_id = p_org
     AND om.user_id = app.current_user_id()
$$;

ALTER FUNCTION app.member_role(uuid) OWNER TO rls_definer;
REVOKE ALL ON FUNCTION app.member_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.member_role(uuid) TO genealogy_app;
GRANT EXECUTE ON FUNCTION app.member_role(uuid) TO rls_definer;

CREATE OR REPLACE FUNCTION app.guard_member_self_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF app.member_role(OLD.organization_id) = 'admin' THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
  THEN
    RAISE EXCEPTION 'member column change not allowed'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_member_self
  BEFORE UPDATE ON public.organization_member
  FOR EACH ROW EXECUTE FUNCTION app.guard_member_self_update();

-- organization
DROP POLICY tenant_isolation ON public.organization;
CREATE POLICY tenant_select ON public.organization
  AS PERMISSIVE FOR SELECT TO genealogy_app
  USING (id = ANY (app.visible_org_array()));
CREATE POLICY tenant_update ON public.organization
  AS PERMISSIVE FOR UPDATE TO genealogy_app
  USING (id = ANY (app.visible_org_array()) AND app.member_role(id) = 'admin')
  WITH CHECK (id = ANY (app.visible_org_array()) AND app.member_role(id) = 'admin');
CREATE POLICY tenant_delete ON public.organization
  AS PERMISSIVE FOR DELETE TO genealogy_app
  USING (id = ANY (app.visible_org_array()) AND app.member_role(id) = 'admin');

-- organization_member
DROP POLICY tenant_isolation ON public.organization_member;
CREATE POLICY tenant_select ON public.organization_member
  AS PERMISSIVE FOR SELECT TO genealogy_app
  USING (organization_id = ANY (app.visible_org_array()));
CREATE POLICY tenant_insert ON public.organization_member
  AS PERMISSIVE FOR INSERT TO genealogy_app
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) = 'admin'
  );
CREATE POLICY tenant_update ON public.organization_member
  AS PERMISSIVE FOR UPDATE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND (
      app.member_role(organization_id) = 'admin'
      OR user_id = app.current_user_id()
    )
  )
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND (
      app.member_role(organization_id) = 'admin'
      OR user_id = app.current_user_id()
    )
  );
CREATE POLICY tenant_delete ON public.organization_member
  AS PERMISSIVE FOR DELETE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND (
      app.member_role(organization_id) = 'admin'
      OR user_id = app.current_user_id()
    )
  );

-- invite: reads stay visible to members; writes are admin
DROP POLICY tenant_isolation ON public.invite;
CREATE POLICY tenant_select ON public.invite
  AS PERMISSIVE FOR SELECT TO genealogy_app
  USING (
    organization_id IN (
      SELECT om.organization_id
        FROM public.organization_member om
       WHERE om.user_id = app.current_user_id()
    )
  );
CREATE POLICY tenant_insert ON public.invite
  AS PERMISSIVE FOR INSERT TO genealogy_app
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) = 'admin'
  );
CREATE POLICY tenant_update ON public.invite
  AS PERMISSIVE FOR UPDATE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) = 'admin'
  )
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) = 'admin'
  );
CREATE POLICY tenant_delete ON public.invite
  AS PERMISSIVE FOR DELETE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) = 'admin'
  );

-- project
DROP POLICY tenant_isolation ON public.project;
CREATE POLICY tenant_select ON public.project
  AS PERMISSIVE FOR SELECT TO genealogy_app
  USING (
    organization_id IN (
      SELECT om.organization_id
        FROM public.organization_member om
       WHERE om.user_id = app.current_user_id()
    )
  );
CREATE POLICY tenant_insert ON public.project
  AS PERMISSIVE FOR INSERT TO genealogy_app
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );
CREATE POLICY tenant_update ON public.project
  AS PERMISSIVE FOR UPDATE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  )
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );
CREATE POLICY tenant_delete ON public.project
  AS PERMISSIVE FOR DELETE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) = 'admin'
  );

-- person, person_name, person_relation, lineage_projection
DROP POLICY tenant_isolation ON public.person;
DROP POLICY tenant_isolation ON public.person_name;
DROP POLICY tenant_isolation ON public.person_relation;
DROP POLICY tenant_isolation ON public.lineage_projection;

CREATE POLICY tenant_select ON public.person
  AS PERMISSIVE FOR SELECT TO genealogy_app
  USING (
    organization_id IN (
      SELECT om.organization_id
        FROM public.organization_member om
       WHERE om.user_id = app.current_user_id()
    )
  );
CREATE POLICY tenant_insert ON public.person
  AS PERMISSIVE FOR INSERT TO genealogy_app
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );
CREATE POLICY tenant_update ON public.person
  AS PERMISSIVE FOR UPDATE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  )
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );
CREATE POLICY tenant_delete ON public.person
  AS PERMISSIVE FOR DELETE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );

CREATE POLICY tenant_select ON public.person_name
  AS PERMISSIVE FOR SELECT TO genealogy_app
  USING (
    organization_id IN (
      SELECT om.organization_id
        FROM public.organization_member om
       WHERE om.user_id = app.current_user_id()
    )
  );
CREATE POLICY tenant_insert ON public.person_name
  AS PERMISSIVE FOR INSERT TO genealogy_app
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );
CREATE POLICY tenant_update ON public.person_name
  AS PERMISSIVE FOR UPDATE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  )
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );
CREATE POLICY tenant_delete ON public.person_name
  AS PERMISSIVE FOR DELETE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );

CREATE POLICY tenant_select ON public.person_relation
  AS PERMISSIVE FOR SELECT TO genealogy_app
  USING (
    organization_id IN (
      SELECT om.organization_id
        FROM public.organization_member om
       WHERE om.user_id = app.current_user_id()
    )
  );
CREATE POLICY tenant_insert ON public.person_relation
  AS PERMISSIVE FOR INSERT TO genealogy_app
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );
CREATE POLICY tenant_update ON public.person_relation
  AS PERMISSIVE FOR UPDATE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  )
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );
CREATE POLICY tenant_delete ON public.person_relation
  AS PERMISSIVE FOR DELETE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );

CREATE POLICY tenant_select ON public.lineage_projection
  AS PERMISSIVE FOR SELECT TO genealogy_app
  USING (
    organization_id IN (
      SELECT om.organization_id
        FROM public.organization_member om
       WHERE om.user_id = app.current_user_id()
    )
  );
CREATE POLICY tenant_insert ON public.lineage_projection
  AS PERMISSIVE FOR INSERT TO genealogy_app
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );
CREATE POLICY tenant_update ON public.lineage_projection
  AS PERMISSIVE FOR UPDATE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  )
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );
CREATE POLICY tenant_delete ON public.lineage_projection
  AS PERMISSIVE FOR DELETE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );
