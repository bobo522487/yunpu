# 谱文 P2：版本 CAS 契约与印刷页码 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给谱文补上可单测的整数版本冲突协议、PostgreSQL 契约，以及印刷稿里的 CSS 真实页码。

**Architecture:** 本仓库仍是前端。远端写入先经过纯函数 `applyArticleVersionCas`，再由 `saveArticleRemote` 把 409 解析成冲突对象。本地模式继续写 Zustand，不假装有服务器。SQL 放在契约文件里，供后端仓库原样执行；这里用并发用例证明第二次写入不会静默覆盖。印刷模式在现有校对 HTML 上增加 `@page` 计数器，屏幕阅读器仍使用谱书编译器已经生成的页。

**Tech Stack:** 现有 `bun test`、Zustand、`features/books/bookCompiler.ts`。不新增 Hocuspocus、Yjs、Vivliostyle 或 OCR 依赖。

## Global Constraints

- 先完成 P0 与 P1 计划。本计划使用 `ArticleDocument.version`、`diffArticleParagraphs` 和 `generateProofHtmlDocument`。
- 不换编辑器，不在本仓库实现 WebSocket、CRDT、Redis、Hocuspocus。
- 多人同屏抢编辑还没出现。Hocuspocus 留到出现「同一篇谱文被两人同时打开并互相覆盖」的使用记录后再单独立项。
- 旧谱 OCR 不在本计划。它需要独立的识别、人工确认和定稿保护流程。
- 不把 `splitHtmlIntoPages` 换成 Vivliostyle。字符分页仍然只服务应用内翻页。印刷 HTML 的页码交给 `@page` 计数器。精确目录页码要等印刷样张证明字符分页把标题拆坏之后，再单独立项接入 Vivliostyle。
- `features/articles/domain/` 与 `features/articles/api.ts` 零 React。冲突对话框可以是 React，但选择结果必须先经过纯函数。
- CAS 的比较字段是整数 `version`。更新条件是 `version = expectedVersion`，成功后 `version + 1`。不匹配时返回 409 和服务器当前文档，不写库。
- 前端在 `VITE_ENABLE_MOCK !== '0'` 且没有 `VITE_API_PROXY_TARGET` 时继续用本地 store。只有 `resolveApiMode` 返回 `network` 时才调用 `saveArticleRemote`。
- SQL 使用规格里的表名 `articles`、`article_person_links`、`article_revisions`，租户条件使用 `current_setting('app.tenant_id')::uuid`。

## 文件结构

- `features/articles/domain/articleCas.ts`：比较版本并给出下一次版本号。
- `features/articles/domain/articleConflict.ts`：保留本地或采用服务器的结果。
- `features/articles/api.ts`：远端保存和 409 解析。
- `features/articles/contract/articles.sql`：表、索引、RLS 和 CAS 更新语句。
- `features/articles/components/ArticleConflictDialog.tsx`：对比、保留我的副本、拉取最新。
- 修改 `features/books/bookCompiler.ts` 的印刷 CSS。
- 修改 `store/useArticleStore.ts` 的保存入口，让 network 模式走 API。

---

### Task 1: 整数版本冲突的纯函数

**Files:**
- Create: `features/articles/domain/articleCas.ts`
- Test: `features/articles/domain/articleCas.test.ts`

**Interfaces:**
- Consumes: `{ version: number } | null` 与客户端 `expectedVersion`。
- Produces: `applyArticleVersionCas(current: { version: number } | null, expectedVersion: number): { ok: true; nextVersion: number } | { ok: false; serverVersion: number }`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyArticleVersionCas } from './articleCas.ts';

test('版本一致时加一', () => {
  assert.deepEqual(applyArticleVersionCas({ version: 4 }, 4), { ok: true, nextVersion: 5 });
});

test('版本不一致时返回服务器版本且不前进', () => {
  assert.deepEqual(applyArticleVersionCas({ version: 5 }, 4), { ok: false, serverVersion: 5 });
});

test('文档不存在时服务器版本记为 0', () => {
  assert.deepEqual(applyArticleVersionCas(null, 1), { ok: false, serverVersion: 0 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test features/articles/domain/articleCas.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: Write minimal implementation**

```ts
export function applyArticleVersionCas(
  current: { version: number } | null,
  expectedVersion: number,
): { ok: true; nextVersion: number } | { ok: false; serverVersion: number } {
  if (!current) return { ok: false, serverVersion: 0 };
  if (current.version !== expectedVersion) return { ok: false, serverVersion: current.version };
  return { ok: true, nextVersion: current.version + 1 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test features/articles/domain/articleCas.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add features/articles/domain/articleCas.ts features/articles/domain/articleCas.test.ts
git commit -m "feat: 用整数版本判断谱文是否写冲突"
```

---

### Task 2: 两次写入不会静默覆盖

**Files:**
- Create: `features/articles/domain/articleCasMemory.ts`
- Test: `features/articles/domain/articleCasMemory.test.ts`

**Interfaces:**
- Consumes: `applyArticleVersionCas`、`ArticleDocument`。
- Produces: `createMemoryArticleTable(): { read(id: string): ArticleDocument | null; write(expectedVersion: number, next: ArticleDocument): { ok: true; version: number } | { ok: false; server: ArticleDocument | null } }`

`write` 只有 CAS 成功才替换行。失败时返回写入前的服务器文档。

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ArticleDocument } from '../types';
import { createMemoryArticleTable } from './articleCasMemory.ts';

function doc(version: number, title: string): ArticleDocument {
  return {
    id: 'a1',
    title,
    docType: 'custom',
    status: 'draft',
    privacy: 'clan',
    contentHtml: `<p>${title}</p>`,
    linkedPersonIds: [],
    linkedChartIds: [],
    citations: [],
    version,
    wordCount: title.length,
    updatedAt: '',
  };
}

test('后写的旧版本不能覆盖新版本', () => {
  const table = createMemoryArticleTable();
  assert.equal(table.write(0, doc(1, '甲')).ok, true);
  const lost = table.write(1, doc(2, '乙'));
  assert.equal(lost.ok, true);
  const conflict = table.write(1, doc(2, '丙'));
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.server?.title, '乙');
  assert.equal(table.read('a1')?.title, '乙');
  assert.equal(table.read('a1')?.version, 2);
});
```

第一个 `write(0, doc(1))` 表示空表允许 expectedVersion `0` 创建版本 1。实现时：当前行不存在且 `expectedVersion === 0` 时插入 `next`，并把 `next.version` 设为 1。之后的写入必须调用 `applyArticleVersionCas`。

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test features/articles/domain/articleCasMemory.test.ts`

Expected: FAIL。

- [ ] **Step 3: Write minimal implementation**

```ts
import type { ArticleDocument } from '../types';
import { applyArticleVersionCas } from './articleCas';

export function createMemoryArticleTable() {
  const rows = new Map<string, ArticleDocument>();
  return {
    read(id: string) {
      return rows.get(id) ?? null;
    },
    write(expectedVersion: number, next: ArticleDocument) {
      const current = rows.get(next.id) ?? null;
      if (!current && expectedVersion === 0) {
        const created = { ...next, version: 1 };
        rows.set(next.id, created);
        return { ok: true as const, version: 1 };
      }
      const decision = applyArticleVersionCas(current, expectedVersion);
      if (!decision.ok) return { ok: false as const, server: current };
      const saved = { ...next, version: decision.nextVersion };
      rows.set(next.id, saved);
      return { ok: true as const, version: decision.nextVersion };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test features/articles/domain/articleCasMemory.test.ts`

Expected: PASS。服务器标题仍是「乙」，版本仍是 2。

- [ ] **Step 5: Commit**

```bash
git add features/articles/domain/articleCasMemory.ts features/articles/domain/articleCasMemory.test.ts
git commit -m "test: 旧版本谱文不能静默覆盖新版本"
```

---

### Task 3: 远端 409 与冲突选择

**Files:**
- Create: `features/articles/api.ts`
- Create: `features/articles/domain/articleConflict.ts`
- Create: `features/articles/components/ArticleConflictDialog.tsx`
- Test: `features/articles/api.test.ts`
- Test: `features/articles/domain/articleConflict.test.ts`

**Interfaces:**
- Consumes: `ArticleDocument`、`diffArticleParagraphs`。
- Produces:
  - `ArticleWriteRequest = { articleId: string; expectedVersion: number; article: ArticleDocument }`
  - `saveArticleRemote(fetchImpl: typeof fetch, url: string, request: ArticleWriteRequest): Promise<{ ok: true; article: ArticleDocument } | { ok: false; status: 409; server: ArticleDocument }>`
  - `resolveArticleConflict(choice: 'keep-local' | 'take-server', local: ArticleDocument, server: ArticleDocument): ArticleDocument`

`keep-local` 返回本地正文，但 `version` 改为 `server.version`，让下一次 CAS 带着服务器版本提交。`take-server` 返回服务器文档本身。

- [ ] **Step 1: Write the failing test**

`articleConflict.test.ts`：

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ArticleDocument } from '../types';
import { resolveArticleConflict } from './articleConflict.ts';

function doc(version: number, title: string): ArticleDocument {
  return {
    id: 'a1',
    title,
    docType: 'custom',
    status: 'draft',
    privacy: 'clan',
    contentHtml: '<p></p>',
    contentJson: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: title }] }] },
    linkedPersonIds: [],
    linkedChartIds: [],
    citations: [],
    version,
    wordCount: 1,
    updatedAt: '',
  };
}

test('保留本地副本时改用服务器版本号', () => {
  const resolved = resolveArticleConflict('keep-local', doc(3, '本地'), doc(5, '服务器'));
  assert.equal(resolved.title, '本地');
  assert.equal(resolved.version, 5);
});

test('拉取最新时采用服务器文档', () => {
  const resolved = resolveArticleConflict('take-server', doc(3, '本地'), doc(5, '服务器'));
  assert.equal(resolved.title, '服务器');
  assert.equal(resolved.version, 5);
});
```

`api.test.ts`：

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { saveArticleRemote } from './api.ts';

test('409 解析出服务器文档', async () => {
  const server = { id: 'a1', version: 5, title: '服务器' };
  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify({ article: server }), { status: 409 });
  const result = await saveArticleRemote(fetchImpl, '/api/articles/a1', {
    articleId: 'a1',
    expectedVersion: 4,
    article: server as never,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 409);
    assert.equal(result.server.version, 5);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test features/articles/domain/articleConflict.test.ts features/articles/api.test.ts`

Expected: FAIL。

- [ ] **Step 3: Write minimal implementation**

`articleConflict.ts`：

```ts
import type { ArticleDocument } from '../types';

export function resolveArticleConflict(
  choice: 'keep-local' | 'take-server',
  local: ArticleDocument,
  server: ArticleDocument,
): ArticleDocument {
  if (choice === 'take-server') return server;
  return { ...local, version: server.version };
}
```

`api.ts`：

```ts
import type { ArticleDocument } from './types';

export interface ArticleWriteRequest {
  articleId: string;
  expectedVersion: number;
  article: ArticleDocument;
}

export async function saveArticleRemote(
  fetchImpl: typeof fetch,
  url: string,
  request: ArticleWriteRequest,
): Promise<
  | { ok: true; article: ArticleDocument }
  | { ok: false; status: 409; server: ArticleDocument }
> {
  const response = await fetchImpl(url, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      expectedVersion: request.expectedVersion,
      article: request.article,
    }),
  });
  const body = (await response.json()) as { article: ArticleDocument };
  if (response.status === 409) return { ok: false, status: 409, server: body.article };
  if (!response.ok) throw new Error(`谱文保存失败：${response.status}`);
  return { ok: true, article: body.article };
}
```

`ArticleConflictDialog.tsx` 接收 `local`、`server`、`onChoose(choice)`。正文区调用 `diffArticleParagraphs(server.contentJson ?? { type: 'doc' }, local.contentJson ?? { type: 'doc' })`。三个按钮的文案固定为「对比差异」「保留我的副本」「拉取最新」。对比按钮只滚动到 diff，不关闭。另外两个按钮调用 `onChoose`。

`useArticleStore.updateArticleContent` 在 `resolveApiMode(import.meta.env) === 'network'` 时，先用当前文档版本作为 `expectedVersion` 调用 `saveArticleRemote`。成功则用返回文档替换本地行。409 时把 `{ local, server }` 存进 store 的 `articleConflict` 字段，不替换本地正文。对话框选择 `keep-local` 后再次提交 `resolveArticleConflict` 的结果；选择 `take-server` 时直接用服务器文档替换本地行。mock 模式不调用 fetch。

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test features/articles/domain/articleConflict.test.ts features/articles/api.test.ts && bun run lint`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add features/articles/api.ts features/articles/api.test.ts features/articles/domain/articleConflict.ts features/articles/domain/articleConflict.test.ts features/articles/components/ArticleConflictDialog.tsx store/useArticleStore.ts
git commit -m "feat: 谱文远端保存遇到 409 时交给用户选择"
```

---

### Task 4: PostgreSQL 契约

**Files:**
- Create: `features/articles/contract/articles.sql`
- Test: `features/articles/contract/articlesContract.test.ts`

**Interfaces:**
- Consumes: 规格第 3.2 节的三张表和 CAS 更新语句。
- Produces: 一份可执行 SQL。测试只检查契约文本含有表名、RLS 和 `version = version + 1`，不连接数据库。

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

test('谱文 SQL 契约包含三张表、RLS 和 CAS', () => {
  const sql = readFileSync(new URL('./articles.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE articles/);
  assert.match(sql, /CREATE TABLE article_person_links/);
  assert.match(sql, /CREATE TABLE article_revisions/);
  assert.match(sql, /FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /current_setting\('app\.tenant_id'\)::uuid/);
  assert.match(sql, /version = version \+ 1/);
  assert.match(sql, /AND version = \$5/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test features/articles/contract/articlesContract.test.ts`

Expected: FAIL，文件不存在。

- [ ] **Step 3: Write minimal implementation**

把规格中的三张表原样写入 `features/articles/contract/articles.sql`，并追加：

```sql
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
```

同一事务里先执行这条 `UPDATE`。影响行数为 0 时返回 409，不写 `article_revisions`，也不改 `article_person_links`。影响行数为 1 时，删除该 `article_id` 的旧 link 行，再按 `linkedPersonIds` 插入新行，并插入一条 `article_revisions`。

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test features/articles/contract/articlesContract.test.ts`

Expected: PASS。本仓库没有 PostgreSQL，不在这里启动数据库。

- [ ] **Step 5: Commit**

```bash
git add features/articles/contract/articles.sql features/articles/contract/articlesContract.test.ts
git commit -m "docs: 写入谱文 PostgreSQL 的 RLS 与 CAS 契约"
```

---

### Task 5: 印刷稿使用 CSS 页码

**Files:**
- Modify: `features/books/bookCompiler.ts`
- Test: `features/books/bookCompiler.print.test.ts`

**Interfaces:**
- Consumes: `generateProofHtmlDocument(book, edition, mode)`。
- Produces: `mode === 'print'` 的 HTML 含 `@page`、`counter(page)` 和 `counter(pages)`。`mode === 'proof'` 不含 `counter(pages)`。两种模式都保留现有 `.book-page` 屏幕预览。

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BookEdition, BookRecord } from './types';
import { generateProofHtmlDocument } from './bookCompiler.ts';

const book = {
  bookName: '陈氏族谱',
  volumeNo: '卷一',
  editor: '编委会',
  compilationDate: '2026-11-24',
} as BookRecord;

const edition = {
  layoutSnapshot: {
    fontFamily: 'song',
    showHeaderName: true,
    showHallName: true,
    pageNumberStyle: 'arabic',
  },
  pages: [],
} as BookEdition;

test('印刷稿声明 CSS 页码，校对稿不声明总页计数器', () => {
  const printHtml = generateProofHtmlDocument(book, edition, 'print');
  assert.match(printHtml, /@page/);
  assert.match(printHtml, /counter\(page\)/);
  assert.match(printHtml, /counter\(pages\)/);
  const proofHtml = generateProofHtmlDocument(book, edition, 'proof');
  assert.doesNotMatch(proofHtml, /counter\(pages\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test features/books/bookCompiler.print.test.ts`

Expected: FAIL，现有 `<style>` 没有 `counter(pages)`。

- [ ] **Step 3: Write minimal implementation**

在 `generateProofHtmlDocument` 的 `<style>` 末尾按 mode 追加。`print` 模式追加：

```css
@page {
  size: A4;
  margin: 18mm 16mm 20mm;
  @bottom-center { content: counter(page) " / " counter(pages); }
}
@media print {
  .page-foot { display: none; }
}
```

`proof` 模式不追加这段。不要删除 `splitHtmlIntoPages`，也不要改应用内翻页组件。

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test features/books/bookCompiler.print.test.ts && bun run lint`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add features/books/bookCompiler.ts features/books/bookCompiler.print.test.ts
git commit -m "feat: 印刷稿使用 CSS 页码计数器"
```

---

## Spec coverage

- PostgreSQL 三张表、RLS 和整数 CAS：Task 1、2、4。
- 409 后的对比、保留副本、拉取最新：Task 3。
- 印刷页码从编辑器假页码移到出版 HTML：Task 5。
- Hocuspocus：不实施。触发条件是同一篇谱文出现多人同屏抢编辑。
- 旧谱 OCR：不实施。触发条件是影印校对进入排期，并且结果必须经审校确认后才能写定稿。
- Vivliostyle：不实施。触发条件是印刷样张证明现有字符分页拆坏了标题或表格。
