-- 规格第 3.2 节：谱文 PostgreSQL 表结构（供后端仓库原样执行）

CREATE TABLE articles (
  id                UUID PRIMARY KEY,
  tenant_id         UUID NOT NULL,
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_folder_id  UUID NULL,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  title             TEXT NOT NULL,
  subtitle          TEXT NOT NULL DEFAULT '',
  author            TEXT NOT NULL DEFAULT '',
  doc_type          TEXT NOT NULL DEFAULT 'custom',
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'review', 'approved')),
  privacy           TEXT NOT NULL DEFAULT 'clan'
                    CHECK (privacy IN ('public', 'clan', 'editors')),
  content_json      JSONB NOT NULL,
  content_html      TEXT NOT NULL,
  citations         JSONB NOT NULL DEFAULT '[]'::jsonb,
  word_count        INTEGER NOT NULL DEFAULT 0,
  version           INTEGER NOT NULL DEFAULT 1,
  updated_by        UUID NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE article_person_links (
  tenant_id   UUID NOT NULL,
  project_id  UUID NOT NULL,
  article_id  UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  person_id   UUID NOT NULL,
  chart_id    UUID NULL,
  PRIMARY KEY (article_id, person_id)
);
CREATE INDEX idx_article_person_reverse
  ON article_person_links (tenant_id, project_id, person_id);

CREATE TABLE article_revisions (
  id            UUID PRIMARY KEY,
  tenant_id     UUID NOT NULL,
  article_id    UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL,
  status        TEXT NOT NULL,
  title         TEXT NOT NULL,
  content_json  JSONB NOT NULL,
  content_html  TEXT NOT NULL,
  word_count    INTEGER NOT NULL,
  summary       TEXT NOT NULL DEFAULT '',
  created_by    UUID NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (article_id, version)
);

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles FORCE ROW LEVEL SECURITY;
ALTER TABLE article_person_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_person_links FORCE ROW LEVEL SECURITY;
ALTER TABLE article_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_revisions FORCE ROW LEVEL SECURITY;

CREATE POLICY articles_tenant ON articles
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY article_person_links_tenant ON article_person_links
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY article_revisions_tenant ON article_revisions
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

-- CAS 正文更新：同一事务里先执行这条 UPDATE。
-- 影响行数为 0 时返回 409，不写 article_revisions，也不改 article_person_links。
-- 影响行数为 1 时，删除该 article_id 的旧 link 行，再按 linkedPersonIds 插入新行，并插入一条 article_revisions。
UPDATE articles
SET content_json = $1,
    content_html = $2,
    word_count = $3,
    version = version + 1,
    updated_at = now()
WHERE id = $4
  AND tenant_id = current_setting('app.tenant_id')::uuid
  AND version = $5
RETURNING version;