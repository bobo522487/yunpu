ALTER TABLE public.organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organization_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_member FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invite ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.organization
  AS PERMISSIVE FOR ALL TO genealogy_app
  USING (id = ANY (app.visible_org_array()))
  WITH CHECK (id = ANY (app.visible_org_array()));

CREATE POLICY tenant_isolation ON public.organization_member
  AS PERMISSIVE FOR ALL TO genealogy_app
  USING (organization_id = ANY (app.visible_org_array()))
  WITH CHECK (organization_id = ANY (app.visible_org_array()));

CREATE POLICY tenant_isolation ON public.invite
  AS PERMISSIVE FOR ALL TO genealogy_app
  USING (organization_id = ANY (app.visible_org_array()))
  WITH CHECK (organization_id = ANY (app.visible_org_array()));

CREATE POLICY tenant_isolation ON public.audit_log
  AS PERMISSIVE FOR ALL TO genealogy_app
  USING (organization_id = ANY (app.visible_org_array()))
  WITH CHECK (organization_id = ANY (app.visible_org_array()));
