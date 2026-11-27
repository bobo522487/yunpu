-- 0028: Article, ArticleRevision, Book, BookEdition persistence + folder kind extension + FORCE RLS.

-- 1. Extend flat folder table with kind ('lineage' | 'article' | 'book').
ALTER TABLE public.folder
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'lineage';

ALTER TABLE public.folder
  DROP CONSTRAINT IF EXISTS ck_folder_kind;
ALTER TABLE public.folder
  ADD CONSTRAINT ck_folder_kind
  CHECK (kind IN ('lineage', 'article', 'book'));

ALTER TABLE public.folder
  DROP CONSTRAINT IF EXISTS uq_folder_project_name;
ALTER TABLE public.folder
  DROP CONSTRAINT IF EXISTS uq_folder_project_kind_name;
ALTER TABLE public.folder
  ADD CONSTRAINT uq_folder_project_kind_name
  UNIQUE (project_id, kind, name);

CREATE INDEX IF NOT EXISTS idx_folder_project_kind
  ON public.folder (project_id, kind);

-- Guard folder kind compatibility for lineage, article, and book rows.
CREATE OR REPLACE FUNCTION app.check_folder_kind_match()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_expected_kind text := TG_ARGV[0];
  v_actual_kind text;
BEGIN
  IF NEW.folder_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT f.kind INTO v_actual_kind
    FROM public.folder f
   WHERE f.project_id = NEW.project_id
     AND f.id = NEW.folder_id;

  IF v_actual_kind IS DISTINCT FROM v_expected_kind THEN
    RAISE EXCEPTION '目录分组类型不匹配' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lineage_folder_kind ON public.lineage;
CREATE TRIGGER trg_lineage_folder_kind
  BEFORE INSERT OR UPDATE OF folder_id ON public.lineage
  FOR EACH ROW EXECUTE FUNCTION app.check_folder_kind_match('lineage');

-- 2. Article table (with integer version CAS and optional folder_id ON DELETE SET NULL).
CREATE TABLE public.article (
  project_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT uuidv7(),
  organization_id uuid NOT NULL,
  folder_id uuid NULL,
  seq integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  author text NOT NULL DEFAULT '',
  doc_type text NOT NULL DEFAULT 'custom',
  status text NOT NULL DEFAULT 'draft',
  privacy text NOT NULL DEFAULT 'clan',
  content_json jsonb NOT NULL DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  content_html text NOT NULL DEFAULT '<p></p>',
  linked_person_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  linked_chart_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  word_count integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_article PRIMARY KEY (project_id, id),
  CONSTRAINT fk_article_project FOREIGN KEY (organization_id, project_id)
    REFERENCES public.project(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_article_folder FOREIGN KEY (project_id, folder_id)
    REFERENCES public.folder(project_id, id) ON DELETE SET NULL (folder_id),
  CONSTRAINT ck_article_title_not_blank CHECK (btrim(title) <> ''),
  CONSTRAINT ck_article_doc_type CHECK (
    doc_type IN ('preface', 'rules', 'origin', 'motto', 'biography', 'inscription', 'custom')
  ),
  CONSTRAINT ck_article_status CHECK (status IN ('draft', 'review', 'approved')),
  CONSTRAINT ck_article_privacy CHECK (privacy IN ('public', 'clan', 'editors')),
  CONSTRAINT ck_article_word_count_non_negative CHECK (word_count >= 0),
  CONSTRAINT ck_article_seq_non_negative CHECK (seq >= 0),
  CONSTRAINT ck_article_version_positive CHECK (version > 0),
  CONSTRAINT ck_article_content_json_object CHECK (jsonb_typeof(content_json) = 'object'),
  CONSTRAINT ck_article_citations_array CHECK (jsonb_typeof(citations) = 'array'),
  CONSTRAINT ck_article_linked_persons_array CHECK (jsonb_typeof(linked_person_ids) = 'array'),
  CONSTRAINT ck_article_linked_charts_array CHECK (jsonb_typeof(linked_chart_ids) = 'array')
);

CREATE INDEX idx_article_org_project ON public.article (organization_id, project_id);
CREATE INDEX idx_article_project_folder ON public.article (project_id, folder_id);

CREATE TRIGGER trg_article_folder_kind
  BEFORE INSERT OR UPDATE OF folder_id ON public.article
  FOR EACH ROW EXECUTE FUNCTION app.check_folder_kind_match('article');

-- 3. Article revision table.
CREATE TABLE public.article_revision (
  project_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT uuidv7(),
  organization_id uuid NOT NULL,
  article_id uuid NOT NULL,
  version integer NOT NULL,
  title text NOT NULL,
  status text NOT NULL,
  content_json jsonb NOT NULL,
  content_html text NOT NULL,
  word_count integer NOT NULL DEFAULT 0,
  summary text NOT NULL DEFAULT '',
  author_name text NOT NULL DEFAULT '',
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_article_revision PRIMARY KEY (project_id, id),
  CONSTRAINT fk_article_revision_project FOREIGN KEY (organization_id, project_id)
    REFERENCES public.project(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_article_revision_article FOREIGN KEY (project_id, article_id)
    REFERENCES public.article(project_id, id) ON DELETE CASCADE,
  CONSTRAINT ck_article_revision_title_not_blank CHECK (btrim(title) <> ''),
  CONSTRAINT ck_article_revision_status CHECK (status IN ('draft', 'review', 'approved')),
  CONSTRAINT ck_article_revision_version_positive CHECK (version > 0),
  CONSTRAINT ck_article_revision_word_count_non_negative CHECK (word_count >= 0),
  CONSTRAINT ck_article_revision_content_json_object CHECK (jsonb_typeof(content_json) = 'object')
);

CREATE INDEX idx_article_revision_org_project
  ON public.article_revision (organization_id, project_id);
CREATE INDEX idx_article_revision_article
  ON public.article_revision (project_id, article_id, created_at);

-- 4. Book table (with integer version CAS, sections catalog, layout_config, optional folder_id).
CREATE TABLE public.book (
  project_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT uuidv7(),
  organization_id uuid NOT NULL,
  folder_id uuid NULL,
  book_name text NOT NULL,
  header_name text NOT NULL DEFAULT '',
  hall_name text NOT NULL DEFAULT '',
  volume_no text NOT NULL DEFAULT '卷一',
  editor text NOT NULL DEFAULT '',
  compilation_date text NOT NULL DEFAULT '',
  sections jsonb NOT NULL,
  layout_config jsonb NOT NULL,
  seq integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_book PRIMARY KEY (project_id, id),
  CONSTRAINT fk_book_project FOREIGN KEY (organization_id, project_id)
    REFERENCES public.project(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_book_folder FOREIGN KEY (project_id, folder_id)
    REFERENCES public.folder(project_id, id) ON DELETE SET NULL (folder_id),
  CONSTRAINT ck_book_name_not_blank CHECK (btrim(book_name) <> ''),
  CONSTRAINT ck_book_volume_no_not_blank CHECK (btrim(volume_no) <> ''),
  CONSTRAINT ck_book_seq_non_negative CHECK (seq >= 0),
  CONSTRAINT ck_book_version_positive CHECK (version > 0),
  CONSTRAINT ck_book_sections_object CHECK (jsonb_typeof(sections) = 'object'),
  CONSTRAINT ck_book_layout_config_object CHECK (jsonb_typeof(layout_config) = 'object')
);

CREATE INDEX idx_book_org_project ON public.book (organization_id, project_id);

CREATE TRIGGER trg_book_folder_kind
  BEFORE INSERT OR UPDATE OF folder_id ON public.book
  FOR EACH ROW EXECUTE FUNCTION app.check_folder_kind_match('book');

-- 5. Book edition snapshot table.
CREATE TABLE public.book_edition (
  project_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT uuidv7(),
  organization_id uuid NOT NULL,
  book_id uuid NOT NULL,
  binding_style text NOT NULL,
  lineage_style text NOT NULL,
  paper_size text NOT NULL,
  page_count integer NOT NULL,
  member_count integer NOT NULL,
  word_count integer NOT NULL,
  print_status text NOT NULL DEFAULT 'none',
  layout_snapshot jsonb NOT NULL,
  pages jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_book_edition PRIMARY KEY (project_id, id),
  CONSTRAINT fk_book_edition_project FOREIGN KEY (organization_id, project_id)
    REFERENCES public.project(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_book_edition_book FOREIGN KEY (project_id, book_id)
    REFERENCES public.book(project_id, id) ON DELETE CASCADE,
  CONSTRAINT ck_book_edition_binding_style CHECK (binding_style IN ('thread', 'hardcover')),
  CONSTRAINT ck_book_edition_lineage_style CHECK (lineage_style IN ('euler', 'su', 'modern_double')),
  CONSTRAINT ck_book_edition_paper_size CHECK (paper_size IN ('thread_185x290', 'a4_210x297', 'k16_185x260')),
  CONSTRAINT ck_book_edition_print_status CHECK (print_status IN ('none', 'finalized')),
  CONSTRAINT ck_book_edition_page_count_non_negative CHECK (page_count >= 0),
  CONSTRAINT ck_book_edition_member_count_non_negative CHECK (member_count >= 0),
  CONSTRAINT ck_book_edition_word_count_non_negative CHECK (word_count >= 0),
  CONSTRAINT ck_book_edition_layout_snapshot_object CHECK (jsonb_typeof(layout_snapshot) = 'object'),
  CONSTRAINT ck_book_edition_pages_array CHECK (jsonb_typeof(pages) = 'array')
);

CREATE INDEX idx_book_edition_org_project
  ON public.book_edition (organization_id, project_id);
CREATE INDEX idx_book_edition_book
  ON public.book_edition (project_id, book_id, created_at);

-- 6. RLS, policies (leaf SELECT uses visible_org_array only), grants, and triggers.
ALTER TABLE public.article ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article FORCE ROW LEVEL SECURITY;
ALTER TABLE public.article_revision ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_revision FORCE ROW LEVEL SECURITY;
ALTER TABLE public.book ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book FORCE ROW LEVEL SECURITY;
ALTER TABLE public.book_edition ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_edition FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_select ON public.article
  AS PERMISSIVE FOR SELECT TO genealogy_app
  USING (organization_id = ANY (app.visible_org_array()));
CREATE POLICY tenant_insert ON public.article
  AS PERMISSIVE FOR INSERT TO genealogy_app
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );
CREATE POLICY tenant_update ON public.article
  AS PERMISSIVE FOR UPDATE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  )
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );
CREATE POLICY tenant_delete ON public.article
  AS PERMISSIVE FOR DELETE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );

CREATE POLICY tenant_select ON public.article_revision
  AS PERMISSIVE FOR SELECT TO genealogy_app
  USING (organization_id = ANY (app.visible_org_array()));
CREATE POLICY tenant_insert ON public.article_revision
  AS PERMISSIVE FOR INSERT TO genealogy_app
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );
CREATE POLICY tenant_update ON public.article_revision
  AS PERMISSIVE FOR UPDATE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  )
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );
CREATE POLICY tenant_delete ON public.article_revision
  AS PERMISSIVE FOR DELETE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );

CREATE POLICY tenant_select ON public.book
  AS PERMISSIVE FOR SELECT TO genealogy_app
  USING (organization_id = ANY (app.visible_org_array()));
CREATE POLICY tenant_insert ON public.book
  AS PERMISSIVE FOR INSERT TO genealogy_app
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );
CREATE POLICY tenant_update ON public.book
  AS PERMISSIVE FOR UPDATE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  )
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );
CREATE POLICY tenant_delete ON public.book
  AS PERMISSIVE FOR DELETE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );

CREATE POLICY tenant_select ON public.book_edition
  AS PERMISSIVE FOR SELECT TO genealogy_app
  USING (organization_id = ANY (app.visible_org_array()));
CREATE POLICY tenant_insert ON public.book_edition
  AS PERMISSIVE FOR INSERT TO genealogy_app
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );
CREATE POLICY tenant_update ON public.book_edition
  AS PERMISSIVE FOR UPDATE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  )
  WITH CHECK (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );
CREATE POLICY tenant_delete ON public.book_edition
  AS PERMISSIVE FOR DELETE TO genealogy_app
  USING (
    organization_id = ANY (app.visible_org_array())
    AND app.member_role(organization_id) IN ('editor', 'admin')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.article TO genealogy_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.article_revision TO genealogy_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book TO genealogy_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_edition TO genealogy_app;

CREATE TRIGGER trg_reject_archived_org_article
  BEFORE INSERT OR UPDATE OR DELETE ON public.article
  FOR EACH ROW EXECUTE FUNCTION app.reject_archived_org_write();
CREATE TRIGGER trg_reject_archived_org_article_revision
  BEFORE INSERT OR UPDATE OR DELETE ON public.article_revision
  FOR EACH ROW EXECUTE FUNCTION app.reject_archived_org_write();
CREATE TRIGGER trg_reject_archived_org_book
  BEFORE INSERT OR UPDATE OR DELETE ON public.book
  FOR EACH ROW EXECUTE FUNCTION app.reject_archived_org_write();
CREATE TRIGGER trg_reject_archived_org_book_edition
  BEFORE INSERT OR UPDATE OR DELETE ON public.book_edition
  FOR EACH ROW EXECUTE FUNCTION app.reject_archived_org_write();

CREATE TRIGGER trg_touch_article_updated_at
  BEFORE UPDATE ON public.article
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER trg_touch_book_updated_at
  BEFORE UPDATE ON public.book
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER trg_guard_scope_immutable
  BEFORE UPDATE ON public.article
  FOR EACH ROW EXECUTE FUNCTION app.guard_scope_immutable();
CREATE TRIGGER trg_guard_scope_immutable
  BEFORE UPDATE ON public.article_revision
  FOR EACH ROW EXECUTE FUNCTION app.guard_scope_immutable();
CREATE TRIGGER trg_guard_scope_immutable
  BEFORE UPDATE ON public.book
  FOR EACH ROW EXECUTE FUNCTION app.guard_scope_immutable();
CREATE TRIGGER trg_guard_scope_immutable
  BEFORE UPDATE ON public.book_edition
  FOR EACH ROW EXECUTE FUNCTION app.guard_scope_immutable();

ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS ck_audit_log_entity_type;
ALTER TABLE public.audit_log ADD CONSTRAINT ck_audit_log_entity_type
  CHECK (entity_type IN (
    'organization', 'organization_member', 'invite', 'audit_log', 'project',
    'folder', 'lineage', 'person', 'person_name', 'person_relation',
    'person_event', 'lineage_projection',
    'article', 'article_revision', 'book', 'book_edition'
  ));
