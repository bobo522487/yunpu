-- 004: Lineage workspace persistence (project.ancestor, folder, lineage, person extensions, person_event, cascade delete, cross-lineage guard).

-- 1. Project ancestor + cascade delete FKs from project to genealogy tables.
ALTER TABLE public.project
  ADD COLUMN IF NOT EXISTS ancestor text;

ALTER TABLE public.project
  DROP CONSTRAINT IF EXISTS ck_project_ancestor_not_blank;
ALTER TABLE public.project
  ADD CONSTRAINT ck_project_ancestor_not_blank
  CHECK (ancestor IS NULL OR btrim(ancestor) <> '');

ALTER TABLE public.person DROP CONSTRAINT IF EXISTS fk_person_project;
ALTER TABLE public.person
  ADD CONSTRAINT fk_person_project
  FOREIGN KEY (organization_id, project_id)
  REFERENCES public.project(organization_id, id) ON DELETE CASCADE;

ALTER TABLE public.person_name DROP CONSTRAINT IF EXISTS fk_person_name_project;
ALTER TABLE public.person_name
  ADD CONSTRAINT fk_person_name_project
  FOREIGN KEY (organization_id, project_id)
  REFERENCES public.project(organization_id, id) ON DELETE CASCADE;

ALTER TABLE public.person_relation DROP CONSTRAINT IF EXISTS fk_person_relation_project;
ALTER TABLE public.person_relation
  ADD CONSTRAINT fk_person_relation_project
  FOREIGN KEY (organization_id, project_id)
  REFERENCES public.project(organization_id, id) ON DELETE CASCADE;

ALTER TABLE public.lineage_projection DROP CONSTRAINT IF EXISTS fk_lineage_projection_project;
ALTER TABLE public.lineage_projection
  ADD CONSTRAINT fk_lineage_projection_project
  FOREIGN KEY (organization_id, project_id)
  REFERENCES public.project(organization_id, id) ON DELETE CASCADE;

-- 2. Flat folder table (no parent_folder_id).
CREATE TABLE public.folder (
  project_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT uuidv7(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  seq integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_folder PRIMARY KEY (project_id, id),
  CONSTRAINT uq_folder_project_name UNIQUE (project_id, name),
  CONSTRAINT fk_folder_project FOREIGN KEY (organization_id, project_id)
    REFERENCES public.project(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT ck_folder_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT ck_folder_seq_non_negative CHECK (seq >= 0)
);

CREATE INDEX idx_folder_org_project ON public.folder (organization_id, project_id);

-- 3. Lineage chart table (nullable folder_id with ON DELETE SET NULL).
CREATE TABLE public.lineage (
  project_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT uuidv7(),
  organization_id uuid NOT NULL,
  folder_id uuid NULL,
  name text NOT NULL,
  surname text NULL,
  hall_name text NULL,
  progenitor text NULL,
  region jsonb NULL,
  seq integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_lineage PRIMARY KEY (project_id, id),
  CONSTRAINT fk_lineage_project FOREIGN KEY (organization_id, project_id)
    REFERENCES public.project(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_lineage_folder FOREIGN KEY (project_id, folder_id)
    REFERENCES public.folder(project_id, id) ON DELETE SET NULL (folder_id),
  CONSTRAINT ck_lineage_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT ck_lineage_surname_not_blank CHECK (surname IS NULL OR btrim(surname) <> ''),
  CONSTRAINT ck_lineage_hall_name_not_blank CHECK (hall_name IS NULL OR btrim(hall_name) <> ''),
  CONSTRAINT ck_lineage_progenitor_not_blank CHECK (progenitor IS NULL OR btrim(progenitor) <> ''),
  CONSTRAINT ck_lineage_seq_non_negative CHECK (seq >= 0),
  CONSTRAINT ck_lineage_version_positive CHECK (version > 0)
);

CREATE INDEX idx_lineage_org_project ON public.lineage (organization_id, project_id);
CREATE INDEX idx_lineage_project_folder ON public.lineage (project_id, folder_id);

-- 4. Person extensions + lineage_id ownership + backfill for any existing rows.
ALTER TABLE public.person
  ADD COLUMN IF NOT EXISTS lineage_id uuid,
  ADD COLUMN IF NOT EXISTS given_name text,
  ADD COLUMN IF NOT EXISTS romanized_surname text,
  ADD COLUMN IF NOT EXISTS romanized_name text,
  ADD COLUMN IF NOT EXISTS romanized_suffix text,
  ADD COLUMN IF NOT EXISTS birth_info jsonb,
  ADD COLUMN IF NOT EXISTS death_info jsonb,
  ADD COLUMN IF NOT EXISTS generation_word text,
  ADD COLUMN IF NOT EXISTS relation_title text,
  ADD COLUMN IF NOT EXISTS sibling_order integer,
  ADD COLUMN IF NOT EXISTS biography text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS avatar_key text;

INSERT INTO public.lineage (organization_id, project_id, name)
SELECT DISTINCT p.organization_id, p.project_id, '主世系'
  FROM public.person p
 WHERE p.lineage_id IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.lineage l WHERE l.project_id = p.project_id
   );

ALTER TABLE public.person DISABLE TRIGGER trg_reject_archived_org_person;
UPDATE public.person p
   SET lineage_id = (
     SELECT l.id
       FROM public.lineage l
      WHERE l.project_id = p.project_id
      ORDER BY l.seq ASC, l.created_at ASC
      LIMIT 1
   )
 WHERE p.lineage_id IS NULL;
ALTER TABLE public.person ENABLE TRIGGER trg_reject_archived_org_person;

ALTER TABLE public.person
  ALTER COLUMN lineage_id SET NOT NULL;

ALTER TABLE public.person
  DROP CONSTRAINT IF EXISTS fk_person_lineage;
ALTER TABLE public.person
  ADD CONSTRAINT fk_person_lineage
  FOREIGN KEY (project_id, lineage_id)
  REFERENCES public.lineage(project_id, id) ON DELETE CASCADE;

ALTER TABLE public.person
  DROP CONSTRAINT IF EXISTS ck_person_sibling_order;
ALTER TABLE public.person
  ADD CONSTRAINT ck_person_sibling_order
  CHECK (sibling_order IS NULL OR sibling_order >= 0);

CREATE INDEX IF NOT EXISTS idx_person_project_lineage
  ON public.person (project_id, lineage_id);

-- 5. Person name extensions.
ALTER TABLE public.person_name
  ADD COLUMN IF NOT EXISTS surname text,
  ADD COLUMN IF NOT EXISTS romanized_surname text,
  ADD COLUMN IF NOT EXISTS romanized_name text,
  ADD COLUMN IF NOT EXISTS label text;

-- 6. Person life events table.
CREATE TABLE public.person_event (
  project_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT uuidv7(),
  organization_id uuid NOT NULL,
  person_id uuid NOT NULL,
  type text NOT NULL,
  structured_date jsonb NULL,
  structured_place jsonb NULL,
  description text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_person_event PRIMARY KEY (project_id, id),
  CONSTRAINT fk_person_event_project FOREIGN KEY (organization_id, project_id)
    REFERENCES public.project(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_person_event_person FOREIGN KEY (project_id, person_id)
    REFERENCES public.person(project_id, id) ON DELETE CASCADE,
  CONSTRAINT ck_person_event_type CHECK (
    type IN ('birth', 'education', 'career', 'marriage', 'residence', 'death', 'other')
  ),
  CONSTRAINT ck_person_event_sort_order CHECK (sort_order >= 0)
);

CREATE INDEX idx_person_event_project_person
  ON public.person_event (project_id, person_id);

-- 7. Cross-lineage relation guard (GX014).
CREATE OR REPLACE FUNCTION app.check_relation_same_lineage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_from_lineage uuid;
  v_to_lineage uuid;
BEGIN
  SELECT lineage_id INTO v_from_lineage
    FROM public.person
   WHERE project_id = NEW.project_id AND id = NEW.from_person_id;
  SELECT lineage_id INTO v_to_lineage
    FROM public.person
   WHERE project_id = NEW.project_id AND id = NEW.to_person_id;

  IF v_from_lineage IS NULL OR v_to_lineage IS NULL OR v_from_lineage IS DISTINCT FROM v_to_lineage THEN
    RAISE EXCEPTION '不能跨越不同谱系图建立人物关系'
      USING ERRCODE = 'GX014';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_person_relation_same_lineage ON public.person_relation;
CREATE TRIGGER trg_person_relation_same_lineage
  BEFORE INSERT OR UPDATE OF from_person_id, to_person_id ON public.person_relation
  FOR EACH ROW EXECUTE FUNCTION app.check_relation_same_lineage();

-- 8. RLS, policies (leaf SELECT uses visible_org_array only), grants, and triggers.
ALTER TABLE public.folder ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folder FORCE ROW LEVEL SECURITY;
ALTER TABLE public.lineage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lineage FORCE ROW LEVEL SECURITY;
ALTER TABLE public.person_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_event FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_select ON public.folder
  AS PERMISSIVE FOR SELECT TO genealogy_app
  USING (organization_id = ANY (app.visible_org_array()));
CREATE POLICY tenant_insert ON public.folder
  AS PERMISSIVE FOR INSERT TO genealogy_app
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );
CREATE POLICY tenant_update ON public.folder
  AS PERMISSIVE FOR UPDATE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  )
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );
CREATE POLICY tenant_delete ON public.folder
  AS PERMISSIVE FOR DELETE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );

CREATE POLICY tenant_select ON public.lineage
  AS PERMISSIVE FOR SELECT TO genealogy_app
  USING (organization_id = ANY (app.visible_org_array()));
CREATE POLICY tenant_insert ON public.lineage
  AS PERMISSIVE FOR INSERT TO genealogy_app
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );
CREATE POLICY tenant_update ON public.lineage
  AS PERMISSIVE FOR UPDATE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  )
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );
CREATE POLICY tenant_delete ON public.lineage
  AS PERMISSIVE FOR DELETE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );

CREATE POLICY tenant_select ON public.person_event
  AS PERMISSIVE FOR SELECT TO genealogy_app
  USING (organization_id = ANY (app.visible_org_array()));
CREATE POLICY tenant_insert ON public.person_event
  AS PERMISSIVE FOR INSERT TO genealogy_app
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );
CREATE POLICY tenant_update ON public.person_event
  AS PERMISSIVE FOR UPDATE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  )
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );
CREATE POLICY tenant_delete ON public.person_event
  AS PERMISSIVE FOR DELETE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.folder TO genealogy_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lineage TO genealogy_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_event TO genealogy_app;

CREATE TRIGGER trg_reject_archived_org_folder
  BEFORE INSERT OR UPDATE OR DELETE ON public.folder
  FOR EACH ROW EXECUTE FUNCTION app.reject_archived_org_write();
CREATE TRIGGER trg_reject_archived_org_lineage
  BEFORE INSERT OR UPDATE OR DELETE ON public.lineage
  FOR EACH ROW EXECUTE FUNCTION app.reject_archived_org_write();
CREATE TRIGGER trg_reject_archived_org_person_event
  BEFORE INSERT OR UPDATE OR DELETE ON public.person_event
  FOR EACH ROW EXECUTE FUNCTION app.reject_archived_org_write();

CREATE TRIGGER trg_touch_folder_updated_at
  BEFORE UPDATE ON public.folder
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER trg_touch_lineage_updated_at
  BEFORE UPDATE ON public.lineage
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER trg_touch_person_event_updated_at
  BEFORE UPDATE ON public.person_event
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS ck_audit_log_entity_type;
ALTER TABLE public.audit_log ADD CONSTRAINT ck_audit_log_entity_type
  CHECK (entity_type IN (
    'organization', 'organization_member', 'invite', 'audit_log', 'project',
    'folder', 'lineage', 'person', 'person_name', 'person_relation',
    'person_event', 'lineage_projection'
  ));
