CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'planning' NOT NULL,
	"surname" text,
	"hall_name" text,
	"origin_text" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "project" ADD CONSTRAINT "fk_project_org" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT;

ALTER TABLE "project" ADD CONSTRAINT "ck_project_status" CHECK ("status" IN ('planning', 'in_progress', 'completed'));
ALTER TABLE "project" ADD CONSTRAINT "ck_project_name_not_blank" CHECK (btrim("name") <> '');
ALTER TABLE "project" ADD CONSTRAINT "ck_project_surname_not_blank" CHECK ("surname" IS NULL OR btrim("surname") <> '');
ALTER TABLE "project" ADD CONSTRAINT "ck_project_hall_name_not_blank" CHECK ("hall_name" IS NULL OR btrim("hall_name") <> '');

CREATE UNIQUE INDEX "uq_project_org_id" ON "project" USING btree ("organization_id", "id");
CREATE INDEX "idx_project_org_status" ON "project" USING btree ("organization_id", "status");

ALTER TABLE "audit_log" DROP CONSTRAINT "ck_audit_log_entity_type";
ALTER TABLE "audit_log" ADD CONSTRAINT "ck_audit_log_entity_type" CHECK ("entity_type" IN ('organization', 'organization_member', 'invite', 'audit_log', 'project'));

ALTER TABLE public.project ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.project
  AS PERMISSIVE FOR ALL TO genealogy_app
  USING (organization_id = ANY (app.visible_org_array()))
  WITH CHECK (organization_id = ANY (app.visible_org_array()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project TO genealogy_app;

CREATE TRIGGER trg_touch_updated_at
  BEFORE UPDATE ON public.project
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
