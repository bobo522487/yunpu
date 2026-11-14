GRANT USAGE ON SCHEMA app TO genealogy_app;
GRANT USAGE ON SCHEMA app TO rls_definer;

GRANT USAGE ON SCHEMA auth TO auth_runtime;
GRANT USAGE ON SCHEMA auth TO rls_definer;

GRANT SELECT, INSERT, DELETE ON public.organization_member TO genealogy_app;
GRANT UPDATE (role, last_used_at, updated_at) ON public.organization_member TO genealogy_app;

GRANT SELECT ON public.organization TO genealogy_app;
GRANT UPDATE (name, status, updated_at) ON public.organization TO genealogy_app;

GRANT SELECT, INSERT ON public.invite TO genealogy_app;

GRANT SELECT, INSERT ON public.audit_log TO genealogy_app;

GRANT SELECT, INSERT ON public.organization TO rls_definer;
GRANT UPDATE (owner_user_id, updated_at) ON public.organization TO rls_definer;

GRANT SELECT, INSERT ON public.organization_member TO rls_definer;
GRANT UPDATE (role, last_used_at, updated_at) ON public.organization_member TO rls_definer;

GRANT SELECT ON public.invite TO rls_definer;
GRANT UPDATE (status, accepted_at, revoked_at, updated_at) ON public.invite TO rls_definer;

GRANT INSERT ON public.audit_log TO rls_definer;

GRANT SELECT (id, email) ON auth."user" TO rls_definer;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO auth_runtime;
