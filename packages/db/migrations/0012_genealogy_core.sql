-- Genealogy core: person / person_name / person_relation / lineage_projection

CREATE TABLE "person" (
  "id" uuid DEFAULT uuidv7() NOT NULL,
  "organization_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "sex" text DEFAULT 'unknown' NOT NULL,
  "surname" text,
  "birth_year" integer,
  "death_year" integer,
  "is_living" boolean DEFAULT true NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "pk_person" PRIMARY KEY ("project_id", "id")
);

ALTER TABLE "person" ADD CONSTRAINT "fk_person_project"
  FOREIGN KEY ("organization_id", "project_id")
  REFERENCES "project" ("organization_id", "id") ON DELETE RESTRICT;
ALTER TABLE "person" ADD CONSTRAINT "ck_person_sex"
  CHECK ("sex" IN ('male', 'female', 'unknown', 'other'));
ALTER TABLE "person" ADD CONSTRAINT "ck_person_surname_not_blank"
  CHECK ("surname" IS NULL OR btrim("surname") <> '');
ALTER TABLE "person" ADD CONSTRAINT "ck_person_version_positive"
  CHECK ("version" > 0);
CREATE UNIQUE INDEX "uq_person_org_id" ON "person" ("organization_id", "id");
CREATE INDEX "idx_person_project_surname" ON "person" ("project_id", "surname")
  WHERE surname IS NOT NULL;

CREATE TABLE "person_name" (
  "id" uuid DEFAULT uuidv7() NOT NULL,
  "organization_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "person_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "value" text NOT NULL,
  "is_primary" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "pk_person_name" PRIMARY KEY ("project_id", "id")
);

ALTER TABLE "person_name" ADD CONSTRAINT "fk_person_name_project"
  FOREIGN KEY ("organization_id", "project_id")
  REFERENCES "project" ("organization_id", "id") ON DELETE RESTRICT;
ALTER TABLE "person_name" ADD CONSTRAINT "fk_person_name_person"
  FOREIGN KEY ("project_id", "person_id")
  REFERENCES "person" ("project_id", "id") ON DELETE CASCADE;
ALTER TABLE "person_name" ADD CONSTRAINT "ck_person_name_kind"
  CHECK ("kind" IN ('formal', 'courtesy', 'art', 'milk', 'genealogy', 'posthumous', 'other'));
ALTER TABLE "person_name" ADD CONSTRAINT "ck_person_name_value_not_blank"
  CHECK (btrim("value") <> '');
CREATE UNIQUE INDEX "uq_person_name_kind_value"
  ON "person_name" ("project_id", "person_id", "kind", "value");
CREATE UNIQUE INDEX "uq_person_name_primary"
  ON "person_name" ("project_id", "person_id") WHERE is_primary;
CREATE INDEX "idx_person_name_person" ON "person_name" ("project_id", "person_id");

CREATE TABLE "person_relation" (
  "id" uuid DEFAULT uuidv7() NOT NULL,
  "organization_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "from_person_id" uuid NOT NULL,
  "to_person_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "from_role_label" text,
  "to_role_label" text,
  "sort_order" integer,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "pk_person_relation" PRIMARY KEY ("project_id", "id")
);

ALTER TABLE "person_relation" ADD CONSTRAINT "fk_person_relation_project"
  FOREIGN KEY ("organization_id", "project_id")
  REFERENCES "project" ("organization_id", "id") ON DELETE RESTRICT;
ALTER TABLE "person_relation" ADD CONSTRAINT "fk_person_relation_from"
  FOREIGN KEY ("project_id", "from_person_id")
  REFERENCES "person" ("project_id", "id") ON DELETE CASCADE;
ALTER TABLE "person_relation" ADD CONSTRAINT "fk_person_relation_to"
  FOREIGN KEY ("project_id", "to_person_id")
  REFERENCES "person" ("project_id", "id") ON DELETE CASCADE;
ALTER TABLE "person_relation" ADD CONSTRAINT "ck_person_relation_not_self"
  CHECK ("from_person_id" <> "to_person_id");
ALTER TABLE "person_relation" ADD CONSTRAINT "ck_person_relation_kind"
  CHECK ("kind" IN (
    'biological_parent', 'adoptive_parent', 'ritual_heir',
    'step_parent', 'foster_parent', 'spouse', 'partner'
  ));
ALTER TABLE "person_relation" ADD CONSTRAINT "ck_person_relation_symmetric_order"
  CHECK ("kind" NOT IN ('spouse', 'partner') OR "from_person_id" < "to_person_id");
ALTER TABLE "person_relation" ADD CONSTRAINT "ck_person_relation_from_role_not_blank"
  CHECK ("from_role_label" IS NULL OR btrim("from_role_label") <> '');
ALTER TABLE "person_relation" ADD CONSTRAINT "ck_person_relation_to_role_not_blank"
  CHECK ("to_role_label" IS NULL OR btrim("to_role_label") <> '');
ALTER TABLE "person_relation" ADD CONSTRAINT "ck_person_relation_sort_order"
  CHECK ("sort_order" IS NULL OR "sort_order" >= 0);
CREATE UNIQUE INDEX "uk_person_relation_kind"
  ON "person_relation" ("project_id", "from_person_id", "to_person_id", "kind");
CREATE INDEX "idx_person_relation_from"
  ON "person_relation" ("project_id", "from_person_id", "kind");
CREATE INDEX "idx_person_relation_to"
  ON "person_relation" ("project_id", "to_person_id", "kind");

CREATE TABLE "lineage_projection" (
  "organization_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "person_id" uuid NOT NULL,
  "primary_path" ltree NOT NULL,
  "generation" integer NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "pk_lineage_projection" PRIMARY KEY ("project_id", "person_id")
);

ALTER TABLE "lineage_projection" ADD CONSTRAINT "fk_lineage_projection_project"
  FOREIGN KEY ("organization_id", "project_id")
  REFERENCES "project" ("organization_id", "id") ON DELETE RESTRICT;
ALTER TABLE "lineage_projection" ADD CONSTRAINT "fk_lineage_projection_person"
  FOREIGN KEY ("project_id", "person_id")
  REFERENCES "person" ("project_id", "id") ON DELETE CASCADE;
CREATE INDEX "idx_lineage_projection_path"
  ON "lineage_projection" USING gist ("project_id", "primary_path");

-- RLS
ALTER TABLE public.person ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person FORCE ROW LEVEL SECURITY;
ALTER TABLE public.person_name ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_name FORCE ROW LEVEL SECURITY;
ALTER TABLE public.person_relation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_relation FORCE ROW LEVEL SECURITY;
ALTER TABLE public.lineage_projection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lineage_projection FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.person
  AS PERMISSIVE FOR ALL TO genealogy_app
  USING (organization_id = ANY (app.visible_org_array()))
  WITH CHECK (organization_id = ANY (app.visible_org_array()));
CREATE POLICY tenant_isolation ON public.person_name
  AS PERMISSIVE FOR ALL TO genealogy_app
  USING (organization_id = ANY (app.visible_org_array()))
  WITH CHECK (organization_id = ANY (app.visible_org_array()));
CREATE POLICY tenant_isolation ON public.person_relation
  AS PERMISSIVE FOR ALL TO genealogy_app
  USING (organization_id = ANY (app.visible_org_array()))
  WITH CHECK (organization_id = ANY (app.visible_org_array()));
CREATE POLICY tenant_isolation ON public.lineage_projection
  AS PERMISSIVE FOR ALL TO genealogy_app
  USING (organization_id = ANY (app.visible_org_array()))
  WITH CHECK (organization_id = ANY (app.visible_org_array()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.person TO genealogy_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_name TO genealogy_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_relation TO genealogy_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lineage_projection TO genealogy_app;

CREATE TRIGGER trg_touch_person_updated_at
  BEFORE UPDATE ON public.person
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER trg_touch_person_name_updated_at
  BEFORE UPDATE ON public.person_name
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER trg_touch_person_relation_updated_at
  BEFORE UPDATE ON public.person_relation
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- Lineage parent helper + cycle check (GX001)
CREATE OR REPLACE FUNCTION app.relation_kind_is_lineage_parent(kind text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT kind IN ('biological_parent', 'adoptive_parent', 'ritual_heir');
$$;

CREATE OR REPLACE FUNCTION app.lock_relation_lineage_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF app.relation_kind_is_lineage_parent(NEW.kind) THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended('yunpu:relation:' || NEW.project_id::text, 0)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.check_ancestor_cycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT app.relation_kind_is_lineage_parent(NEW.kind) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    WITH RECURSIVE descendants AS (
      SELECT r.to_person_id AS person_id
      FROM public.person_relation r
      WHERE r.project_id = NEW.project_id
        AND r.from_person_id = NEW.to_person_id
        AND app.relation_kind_is_lineage_parent(r.kind)
        AND r.id IS DISTINCT FROM NEW.id
      UNION
      SELECT r.to_person_id
      FROM public.person_relation r
      JOIN descendants d ON d.person_id = r.from_person_id
      WHERE r.project_id = NEW.project_id
        AND app.relation_kind_is_lineage_parent(r.kind)
        AND r.id IS DISTINCT FROM NEW.id
    )
    SELECT 1 FROM descendants WHERE person_id = NEW.from_person_id
  ) THEN
    RAISE EXCEPTION 'ancestor cycle detected'
      USING ERRCODE = 'GX001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_person_relation_lock
  BEFORE INSERT OR UPDATE OF from_person_id, to_person_id, kind ON public.person_relation
  FOR EACH ROW EXECUTE FUNCTION app.lock_relation_lineage_write();

CREATE CONSTRAINT TRIGGER trg_person_relation_no_cycle
  AFTER INSERT OR UPDATE ON public.person_relation
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION app.check_ancestor_cycle();

ALTER TABLE "audit_log" DROP CONSTRAINT IF EXISTS "ck_audit_log_entity_type";
ALTER TABLE "audit_log" ADD CONSTRAINT "ck_audit_log_entity_type"
  CHECK ("entity_type" IN (
    'organization', 'organization_member', 'invite', 'audit_log', 'project',
    'person', 'person_name', 'person_relation', 'lineage_projection'
  ));
