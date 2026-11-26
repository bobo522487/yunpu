-- FR-009: 'suspended' is no longer a valid organization status. Remap any
-- legacy rows to 'active' (closest to existing behaviour; 'archived' would
-- irreversibly disable writes) before tightening the CHECK constraint.
UPDATE public.organization
   SET status = 'active'
 WHERE status = 'suspended';

ALTER TABLE public.organization DROP CONSTRAINT "ck_organization_status";
ALTER TABLE public.organization ADD CONSTRAINT "ck_organization_status"
  CHECK ("status" IN ('active', 'archived'));
