-- Wave 4C: drop redundant btree indexes already covered by UNIQUE / leading-column
-- indexes, and remove the unreferenced SECURITY DEFINER function resolve_invite_by_token.

DROP INDEX IF EXISTS auth.idx_auth_user_email;
DROP INDEX IF EXISTS public.idx_person_name_person;

REVOKE ALL ON FUNCTION app.resolve_invite_by_token(text) FROM genealogy_app;
DROP FUNCTION IF EXISTS app.resolve_invite_by_token(text);
