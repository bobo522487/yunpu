-- Wave 2 P1-1: leaf SELECT policies must not re-enter organization_member
-- under RLS. The write policies already use the single STABLE SECURITY
-- DEFINER helper, so reads use the same authority source.

DROP POLICY tenant_select ON public.invite;
CREATE POLICY tenant_select ON public.invite
  AS PERMISSIVE FOR SELECT TO genealogy_app
  USING (organization_id = ANY (app.visible_org_array()));

DROP POLICY tenant_select ON public.project;
CREATE POLICY tenant_select ON public.project
  AS PERMISSIVE FOR SELECT TO genealogy_app
  USING (organization_id = ANY (app.visible_org_array()));

DROP POLICY tenant_select ON public.person;
CREATE POLICY tenant_select ON public.person
  AS PERMISSIVE FOR SELECT TO genealogy_app
  USING (organization_id = ANY (app.visible_org_array()));

DROP POLICY tenant_select ON public.person_name;
CREATE POLICY tenant_select ON public.person_name
  AS PERMISSIVE FOR SELECT TO genealogy_app
  USING (organization_id = ANY (app.visible_org_array()));

DROP POLICY tenant_select ON public.person_relation;
CREATE POLICY tenant_select ON public.person_relation
  AS PERMISSIVE FOR SELECT TO genealogy_app
  USING (organization_id = ANY (app.visible_org_array()));

DROP POLICY tenant_select ON public.lineage_projection;
CREATE POLICY tenant_select ON public.lineage_projection
  AS PERMISSIVE FOR SELECT TO genealogy_app
  USING (organization_id = ANY (app.visible_org_array()));
