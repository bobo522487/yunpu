# 谱文 P0：AST 单一数据源、防抖保存与真 docx Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把谱文正文从 HTML 字符串改成 Tiptap JSON 单一数据源，800ms 防抖后再写 Zustand / IndexedDB，并用标准 `.docx` 替换伪 `.doc` 导出。

**Architecture:** `ArticleDocument.contentJson` 是正文的唯一事实来源，`contentHtml`、`wordCount`、`linkedPersonIds`、`linkedChartIds` 只由纯函数派生。编辑器 `onUpdate` 只标记脏状态；`createArticleSaveQueue` 在 800ms 后或在切换篇章、关闭页、导出、预览前调用 `flush()`。排版扩展、图注和 docx 编解码都消费同一份 `createArticleExtensions()` schema。P0 不接世系 `@人物`、修订快照、谱书定稿校验和后端。

**Tech Stack:** React 19、Vite 8、Zustand 5 persist（`yunpu:articles`）、Tiptap 2.11.5、`bun test`（`node:test` + `node:assert/strict`）、新增 `@tiptap/extension-image@2.11.5`、`mammoth`、`docx`。

## Global Constraints

- 不换编辑器内核：保留 `@tiptap/react` 2.11.5，不引入 Slate、Lexical、BlockNote 或 Vue 版 Umo。
- P0 不上 WebSocket、CRDT、Redis、Hocuspocus。
- 编辑期不做假分页，状态栏和纸页页脚都不得出现 `第 1 页 · 共约 N 页` 或 `约 N 页`。
- `features/articles/domain/` 零 React、零 DOM；IndexedDB 只放在 `features/articles/assets/`。
- 保留 `contentHtml` 字段，供谱书编译、摘要和旧数据读取。
- Zustand persist 的 `name` 仍是 `yunpu:articles`，`version` 从 `1` 升到 `2`。迁移只补字段，不在迁移函数里解析 HTML。
- 持久化 JSON 禁止内联 `data:` Base64，也禁止持久化 `blob:` URL。
- 前端保持独立构建，本计划不新增后端 monorepo 依赖，不新增 `features/articles/api.ts`（留给 P2）。
- 测试命令是 `bun test`；类型检查是 `bun run lint`。
- 自动保存防抖是 800ms。标题、副标题、作者仍立即写入，因为它们不是高频正文输入。
- 谱序、凡例、源流、家训、传记、碑记、自定义、捐资芳名录共用同一 schema 和同一套模板函数，不写第二套编辑器。
- 新增 Tiptap 包版本钉死 `2.11.5`。`mammoth` 与 `docx` 使用安装时解析到的当前版本，不手写猜测版本号。
- 节点名固定为 `figureImage`、`personMention`、`inlineAnnotation`。P0 只注册 `figureImage`；后两个名字先被 metrics 和 docx 遍历器识别，扩展本体在 P1 计划实现。

## 文件结构

- `features/articles/types.ts`：领域类型。`ArticleRevision` 只声明，P0 不写入。
- `features/articles/articleLabels.ts`：文体、状态、隐私的中文标签。
- `features/articles/domain/articleMetrics.ts`：AST 派生字数、段落、阅读时长、大纲、人物和支派 id。
- `features/articles/domain/migrateArticles.ts`：`yunpu:articles` v1 → v2。
- `features/articles/domain/articleSaveQueue.ts`：可注入时钟的 800ms 保存队列。
- `features/articles/domain/htmlProjection.ts`：HTML 与 JSON 的双向投影。
- `features/articles/domain/figureAttrs.ts`：图注属性校验，拒绝 Base64。
- `features/articles/domain/persistableContent.ts`：落库前剥掉临时 `src`。
- `features/articles/domain/articleTemplates.ts`：8 个文体模板。
- `features/articles/domain/docxCodec.ts`：`.docx` 导入导出。
- `features/articles/assets/articleAssetStore.ts`：内存实现与 IndexedDB 实现。
- `features/articles/extensions/TextIndent.ts`、`LineHeight.ts`、`FigureImage.ts`、`createArticleExtensions.ts`。
- `features/articles/styles/puwen-prose.css`：现代 / 仿古两套主题。
- `features/articles/components/ArticleInspectorPanel.tsx`：P0 只显示大纲和统计。
- 修改 `articleData.ts`、`useArticleStore.ts`、`WordArticleEditor.tsx`、`WordToolbar.tsx`、`ArticleMetaModal.tsx`、`ArticlesPage.tsx`、`index.css`。

---

### Task 1: 领域类型与中文标签

**Files:**
- Modify: `features/articles/types.ts`
- Create: `features/articles/articleLabels.ts`
- Test: `features/articles/articleLabels.test.ts`

**Interfaces:**
- Consumes: 无。
- Produces:
  - `ArticleDocType`、`ArticleStatus`、`ArticlePrivacy`、`ArticleCitation`、`ArticleDocument`、`ArticleRevision`、`ArticleMetaInput`
  - `DOC_TYPE_LABELS`、`STATUS_LABELS`、`PRIVACY_LABELS`
  - `ProjectArticleSeedContext` 保持现有字段，仍从 `types.ts` 导出

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DOC_TYPE_LABELS,
  PRIVACY_LABELS,
  STATUS_LABELS,
} from './articleLabels.ts';

test('文体、状态、隐私标签覆盖全部枚举', () => {
  assert.equal(DOC_TYPE_LABELS.preface, '谱序');
  assert.equal(DOC_TYPE_LABELS.rules, '凡例');
  assert.equal(DOC_TYPE_LABELS.origin, '姓氏源流');
  assert.equal(DOC_TYPE_LABELS.motto, '家训族规');
  assert.equal(DOC_TYPE_LABELS.biography, '人物传记');
  assert.equal(DOC_TYPE_LABELS.inscription, '碑记艺文');
  assert.equal(DOC_TYPE_LABELS.custom, '自定义篇目');
  assert.equal(STATUS_LABELS.draft, '草稿');
  assert.equal(STATUS_LABELS.review, '待校');
  assert.equal(STATUS_LABELS.approved, '定稿');
  assert.equal(PRIVACY_LABELS.public, '公开');
  assert.equal(PRIVACY_LABELS.clan, '族内');
  assert.equal(PRIVACY_LABELS.editors, '编委');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test features/articles/articleLabels.test.ts`

Expected: FAIL，`articleLabels.ts` 不存在。

- [ ] **Step 3: Write minimal implementation**

把 `features/articles/types.ts` 整文件替换为：

```ts
import type { JSONContent } from '@tiptap/core';
import type { GenealogyPlace } from '../place-input/place.types';

export type ArticleDocType =
  | 'preface'
  | 'rules'
  | 'origin'
  | 'motto'
  | 'biography'
  | 'inscription'
  | 'custom';

export type ArticleStatus = 'draft' | 'review' | 'approved';
export type ArticlePrivacy = 'public' | 'clan' | 'editors';

export interface ArticleCitation {
  id: string;
  label: string;
  sourceType: 'old_genealogy' | 'stele' | 'gazetteer' | 'oral' | 'archive';
  detail?: string;
  mediaAssetId?: string;
}

export interface ArticleDocument {
  id: string;
  title: string;
  subtitle?: string;
  author?: string;
  docType: ArticleDocType;
  status: ArticleStatus;
  privacy: ArticlePrivacy;
  contentJson?: JSONContent;
  contentHtml: string;
  linkedPersonIds: string[];
  linkedChartIds: string[];
  citations: ArticleCitation[];
  version: number;
  wordCount: number;
  updatedAt: string;
}

export interface ArticleRevision {
  id: string;
  articleId: string;
  version: number;
  title: string;
  status: ArticleStatus;
  contentJson: JSONContent;
  contentHtml: string;
  wordCount: number;
  summary?: string;
  authorName: string;
  createdAt: string;
}

export interface ArticleMetaInput {
  title: string;
  subtitle?: string;
  author?: string;
  docType?: ArticleDocType;
  templateId?: string;
  contentHtml?: string;
  contentJson?: JSONContent;
}

export interface ProjectArticleSeedContext {
  familyName?: string;
  surname?: string;
  hallName?: string;
  ancestor?: string;
  region?: GenealogyPlace | null;
}
```

创建 `features/articles/articleLabels.ts`：

```ts
import type { ArticleDocType, ArticlePrivacy, ArticleStatus } from './types';

export const DOC_TYPE_LABELS: Record<ArticleDocType, string> = {
  preface: '谱序',
  rules: '凡例',
  origin: '姓氏源流',
  motto: '家训族规',
  biography: '人物传记',
  inscription: '碑记艺文',
  custom: '自定义篇目',
};

export const STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: '草稿',
  review: '待校',
  approved: '定稿',
};

export const PRIVACY_LABELS: Record<ArticlePrivacy, string> = {
  public: '公开',
  clan: '族内',
  editors: '编委',
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test features/articles/articleLabels.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add features/articles/types.ts features/articles/articleLabels.ts features/articles/articleLabels.test.ts
git commit -m "feat: 补齐谱文文档类型与中文标签"
```

---

### Task 2: 从 AST 派生字数、大纲和关联 id

**Files:**
- Create: `features/articles/domain/articleMetrics.ts`
- Test: `features/articles/domain/articleMetrics.test.ts`

**Interfaces:**
- Consumes: `JSONContent`。
- Produces:
  - `ArticleHeading = { level: 1 | 2 | 3; text: string }`
  - `ArticleMetrics = { wordCount: number; paragraphCount: number; readingMinutes: number; headings: ArticleHeading[]; linkedPersonIds: string[]; linkedChartIds: string[] }`
  - `extractArticleMetrics(doc: JSONContent | null | undefined): ArticleMetrics`
  - `readingTimeLabel(wordCount: number): string`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { JSONContent } from '@tiptap/core';
import { extractArticleMetrics, readingTimeLabel } from './articleMetrics.ts';

const doc: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: '修谱缘起' }],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: '吾族 ' },
        {
          type: 'personMention',
          attrs: { personId: 'p1', chartId: 'c1', fallbackName: '伯温', generation: 1 },
        },
        { type: 'text', text: '迁居。' },
      ],
    },
    {
      type: 'figureImage',
      attrs: { assetId: 'img1', caption: '宗祠', widthPct: 80, align: 'center' },
    },
  ],
};

test('extractArticleMetrics 统计汉字、标题、人物和支派', () => {
  const metrics = extractArticleMetrics(doc);
  assert.equal(metrics.wordCount, '修谱缘起吾族伯温迁居。宗祠'.length);
  assert.equal(metrics.paragraphCount, 3);
  assert.deepEqual(metrics.headings, [{ level: 2, text: '修谱缘起' }]);
  assert.deepEqual(metrics.linkedPersonIds, ['p1']);
  assert.deepEqual(metrics.linkedChartIds, ['c1']);
  assert.equal(metrics.readingMinutes, 1);
});

test('空文档是 0，而不是伪造 1 段', () => {
  const metrics = extractArticleMetrics({ type: 'doc', content: [] });
  assert.equal(metrics.wordCount, 0);
  assert.equal(metrics.paragraphCount, 0);
  assert.equal(readingTimeLabel(0), '预计阅读 0 分钟');
});

test('阅读时长按 300 字一分钟向上取整', () => {
  assert.equal(readingTimeLabel(301), '预计阅读 2 分钟');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test features/articles/domain/articleMetrics.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: Write minimal implementation**

```ts
import type { JSONContent } from '@tiptap/core';

export interface ArticleHeading {
  level: 1 | 2 | 3;
  text: string;
}

export interface ArticleMetrics {
  wordCount: number;
  paragraphCount: number;
  readingMinutes: number;
  headings: ArticleHeading[];
  linkedPersonIds: string[];
  linkedChartIds: string[];
}

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'listItem',
  'blockquote',
  'figureImage',
  'table',
]);

function textOf(node: JSONContent | null | undefined): string {
  if (!node) return '';
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'personMention' && !(node.content && node.content.length > 0)) {
    return String(node.attrs?.fallbackName ?? '');
  }
  return (node.content ?? []).map((child) => textOf(child)).join('');
}

function countChars(value: string): number {
  return value.replace(/\s+/g, '').length;
}

export function readingTimeLabel(wordCount: number): string {
  if (wordCount <= 0) return '预计阅读 0 分钟';
  return `预计阅读 ${Math.max(1, Math.ceil(wordCount / 300))} 分钟`;
}

export function extractArticleMetrics(doc: JSONContent | null | undefined): ArticleMetrics {
  const headings: ArticleHeading[] = [];
  const linkedPersonIds: string[] = [];
  const linkedChartIds: string[] = [];
  const personSeen = new Set<string>();
  const chartSeen = new Set<string>();
  let paragraphCount = 0;
  let wordCount = 0;

  const visit = (node: JSONContent | null | undefined) => {
    if (!node) return;
    if (node.type && BLOCK_TYPES.has(node.type)) paragraphCount += 1;
    if (node.type === 'heading') {
      const level = node.attrs?.level;
      if (level === 1 || level === 2 || level === 3) {
        headings.push({ level, text: textOf(node).replace(/\s+/g, '') });
      }
    }
    if (node.type === 'personMention') {
      const personId = String(node.attrs?.personId ?? '').trim();
      const chartId = String(node.attrs?.chartId ?? '').trim();
      if (personId && !personSeen.has(personId)) {
        personSeen.add(personId);
        linkedPersonIds.push(personId);
      }
      if (chartId && !chartSeen.has(chartId)) {
        chartSeen.add(chartId);
        linkedChartIds.push(chartId);
      }
    }
    if (node.type === 'text') {
      wordCount += countChars(node.text ?? '');
    } else if (node.type === 'personMention' && !(node.content && node.content.length > 0)) {
      wordCount += countChars(String(node.attrs?.fallbackName ?? ''));
    }
    if (node.type === 'figureImage') {
      wordCount += countChars(String(node.attrs?.caption ?? ''));
    }
    for (const child of node.content ?? []) visit(child);
  };

  visit(doc);
  return {
    wordCount,
    paragraphCount,
    readingMinutes: wordCount <= 0 ? 0 : Math.max(1, Math.ceil(wordCount / 300)),
    headings,
    linkedPersonIds,
    linkedChartIds,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test features/articles/domain/articleMetrics.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add features/articles/domain/articleMetrics.ts features/articles/domain/articleMetrics.test.ts
git commit -m "feat: 用纯函数从谱文 AST 提取字数和大纲"
```

---

### Task 3: v1 文档无损迁移到 v2

**Files:**
- Create: `features/articles/domain/migrateArticles.ts`
- Test: `features/articles/domain/migrateArticles.test.ts`

**Interfaces:**
- Consumes: 旧 persist 快照里的 `articlesByKey`、`treesByProject`、`selectedNodeIdByProject`。
- Produces: `migrateArticlesV1ToV2(persisted: unknown): { treesByProject: Record<string, unknown[]>; selectedNodeIdByProject: Record<string, string>; articlesByKey: Record<string, ArticleDocument> }`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrateArticlesV1ToV2 } from './migrateArticles.ts';

test('v1 谱文补齐默认字段且不生成 contentJson', () => {
  const next = migrateArticlesV1ToV2({
    treesByProject: { p1: [{ id: 'article-preface', type: 'article' }] },
    selectedNodeIdByProject: { p1: 'article-preface' },
    articlesByKey: {
      'p1::article-preface': {
        id: 'article-preface',
        title: '重修族谱序',
        contentHtml: '<p>旧稿</p>',
        wordCount: 2,
        updatedAt: '2024-01-01 00:00',
      },
    },
  });

  const doc = next.articlesByKey['p1::article-preface'];
  assert.equal(doc.docType, 'custom');
  assert.equal(doc.status, 'draft');
  assert.equal(doc.privacy, 'clan');
  assert.deepEqual(doc.linkedPersonIds, []);
  assert.deepEqual(doc.linkedChartIds, []);
  assert.deepEqual(doc.citations, []);
  assert.equal(doc.version, 1);
  assert.equal(doc.contentHtml, '<p>旧稿</p>');
  assert.equal(doc.wordCount, 2);
  assert.equal(doc.contentJson, undefined);
  assert.equal(next.selectedNodeIdByProject.p1, 'article-preface');
});

test('缺省快照不会抛错', () => {
  const next = migrateArticlesV1ToV2(null);
  assert.deepEqual(next.articlesByKey, {});
  assert.deepEqual(next.treesByProject, {});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test features/articles/domain/migrateArticles.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: Write minimal implementation**

```ts
import type { ArticleDocument } from '../types';

interface V1Article {
  id?: string;
  title?: string;
  subtitle?: string;
  author?: string;
  contentHtml?: string;
  contentJson?: ArticleDocument['contentJson'];
  wordCount?: number;
  updatedAt?: string;
  docType?: ArticleDocument['docType'];
  status?: ArticleDocument['status'];
  privacy?: ArticleDocument['privacy'];
  linkedPersonIds?: string[];
  linkedChartIds?: string[];
  citations?: ArticleDocument['citations'];
  version?: number;
}

export function migrateArticlesV1ToV2(persisted: unknown): {
  treesByProject: Record<string, unknown[]>;
  selectedNodeIdByProject: Record<string, string>;
  articlesByKey: Record<string, ArticleDocument>;
} {
  const state = (persisted ?? {}) as {
    treesByProject?: Record<string, unknown[]>;
    selectedNodeIdByProject?: Record<string, string>;
    articlesByKey?: Record<string, V1Article>;
  };
  const articlesByKey: Record<string, ArticleDocument> = {};
  for (const [key, doc] of Object.entries(state.articlesByKey ?? {})) {
    articlesByKey[key] = {
      id: doc.id || key.split('::').pop() || key,
      title: doc.title || '未命名谱文',
      subtitle: doc.subtitle || '',
      author: doc.author || '',
      docType: doc.docType || 'custom',
      status: doc.status || 'draft',
      privacy: doc.privacy || 'clan',
      contentJson: doc.contentJson,
      contentHtml: doc.contentHtml || '<p></p>',
      linkedPersonIds: doc.linkedPersonIds || [],
      linkedChartIds: doc.linkedChartIds || [],
      citations: doc.citations || [],
      version: doc.version || 1,
      wordCount: doc.wordCount || 0,
      updatedAt: doc.updatedAt || '',
    };
  }
  return {
    treesByProject: state.treesByProject || {},
    selectedNodeIdByProject: state.selectedNodeIdByProject || {},
    articlesByKey,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test features/articles/domain/migrateArticles.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add features/articles/domain/migrateArticles.ts features/articles/domain/migrateArticles.test.ts
git commit -m "feat: 谱文本地存储从 v1 无损迁移到 v2"
```

---

### Task 4: 首行缩进、行距、图注和共享 schema

**Files:**
- Create: `features/articles/extensions/TextIndent.ts`
- Create: `features/articles/extensions/LineHeight.ts`
- Create: `features/articles/extensions/FigureImage.ts`
- Create: `features/articles/extensions/createArticleExtensions.ts`
- Test: `features/articles/extensions/articleSchema.test.ts`
- Modify: `package.json`、`bun.lock`

**Interfaces:**
- Consumes: 已安装的 `@tiptap/starter-kit` 与 `FontSize`。
- Produces: `createArticleExtensions(): AnyExtension[]`。命令 `setTextIndent(value: '0' | '2em')`、`setLineHeight(value: '1.5' | '1.8' | '2.0' | null)`。`figureImage` 属性 `assetId`、`caption`、`widthPct`、`align`、`src`。

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateHTML } from '@tiptap/core';
import { createArticleExtensions } from './createArticleExtensions.ts';

test('段落输出首行缩进和行距', () => {
  const html = generateHTML(
    {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { textIndent: '2em', lineHeight: '1.8' },
          content: [{ type: 'text', text: '谱序' }],
        },
      ],
    },
    createArticleExtensions(),
  );
  assert.match(html, /text-indent:\s*2em/);
  assert.match(html, /line-height:\s*1\.8/);
  assert.match(html, /谱序/);
});

test('图注节点输出 figure、assetId 和 figcaption', () => {
  const html = generateHTML(
    {
      type: 'doc',
      content: [
        {
          type: 'figureImage',
          attrs: {
            assetId: 'asset-1',
            caption: '宗祠旧影',
            widthPct: 70,
            align: 'center',
            src: null,
          },
        },
      ],
    },
    createArticleExtensions(),
  );
  assert.match(html, /<figure/);
  assert.match(html, /data-asset-id="asset-1"/);
  assert.match(html, /宗祠旧影/);
  assert.doesNotMatch(html, /data:/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test features/articles/extensions/articleSchema.test.ts`

Expected: FAIL，`createArticleExtensions` 不存在。

- [ ] **Step 3: Write minimal implementation**

Run:

```bash
bun add @tiptap/extension-image@2.11.5
```

`features/articles/extensions/TextIndent.ts`：

```ts
import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textIndent: {
      setTextIndent: (textIndent: '0' | '2em') => ReturnType;
    };
  }
}

export const TextIndent = Extension.create({
  name: 'textIndent',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          textIndent: {
            default: null,
            parseHTML: (element) => element.style.textIndent || null,
            renderHTML: (attributes) => {
              if (!attributes.textIndent) return {};
              return { style: `text-indent: ${attributes.textIndent}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTextIndent:
        (textIndent) =>
        ({ editor, commands }) => {
          const type = editor.isActive('heading') ? 'heading' : 'paragraph';
          return commands.updateAttributes(type, { textIndent });
        },
    };
  },
});
```

`features/articles/extensions/LineHeight.ts`：

```ts
import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    lineHeight: {
      setLineHeight: (lineHeight: '1.5' | '1.8' | '2.0' | null) => ReturnType;
    };
  }
}

export const LineHeight = Extension.create({
  name: 'lineHeight',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) => {
              if (!attributes.lineHeight) return {};
              return { style: `line-height: ${attributes.lineHeight}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineHeight:
        (lineHeight) =>
        ({ editor, commands }) => {
          const type = editor.isActive('heading') ? 'heading' : 'paragraph';
          return commands.updateAttributes(type, { lineHeight });
        },
    };
  },
});
```

`features/articles/extensions/FigureImage.ts`：

```ts
import Image from '@tiptap/extension-image';
import { mergeAttributes } from '@tiptap/core';

export const FigureImage = Image.extend({
  name: 'figureImage',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      assetId: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-asset-id') || '',
        renderHTML: (attributes) => ({ 'data-asset-id': attributes.assetId || undefined }),
      },
      src: {
        default: null,
        parseHTML: (element) => element.getAttribute('src'),
        renderHTML: () => ({}),
      },
      alt: { default: '' },
      caption: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-caption') || '',
        renderHTML: (attributes) => ({ 'data-caption': attributes.caption || undefined }),
      },
      widthPct: {
        default: 80,
        parseHTML: (element) => Number(element.getAttribute('data-width-pct') || 80),
        renderHTML: (attributes) => ({ 'data-width-pct': String(attributes.widthPct ?? 80) }),
      },
      align: {
        default: 'center',
        parseHTML: (element) => element.getAttribute('data-align') || 'center',
        renderHTML: (attributes) => ({ 'data-align': attributes.align || 'center' }),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'figure[data-asset-id]' },
      { tag: 'img[data-asset-id]' },
      {
        tag: 'img',
        getAttrs: (element) => {
          const src = (element as HTMLElement).getAttribute('src') || '';
          if (!src.startsWith('asset://')) return false;
          return { assetId: src.slice('asset://'.length), src: null, caption: '' };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const caption = String(HTMLAttributes['data-caption'] ?? '');
    return [
      'figure',
      mergeAttributes(HTMLAttributes, { class: 'puwen-figure' }),
      ['img', { 'data-asset-id': HTMLAttributes['data-asset-id'], alt: caption }],
      ['figcaption', {}, caption],
    ];
  },
});
```

`features/articles/extensions/createArticleExtensions.ts`：

```ts
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import { Color } from '@tiptap/extension-color';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Placeholder from '@tiptap/extension-placeholder';
import type { AnyExtension } from '@tiptap/core';
import { FontSize } from './FontSize';
import { TextIndent } from './TextIndent';
import { LineHeight } from './LineHeight';
import { FigureImage } from './FigureImage';

export function createArticleExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    Underline,
    TextStyle,
    FontFamily,
    FontSize,
    Color,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TextIndent,
    LineHeight,
    FigureImage,
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    Placeholder.configure({
      placeholder: '在此撰写谱文正文，支持标题、列表、引用与表格排版……',
    }),
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test features/articles/extensions/articleSchema.test.ts`

Expected: PASS。若 `generateHTML` 的 style 合并把缩进和行距写成同一个 `style` 属性，断言仍用 `assert.match` 检查两个声明都在。

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock features/articles/extensions features/articles/extensions/articleSchema.test.ts
git commit -m "feat: 增加谱文缩进、行距和图注 schema"
```

---

### Task 5: HTML 与 JSON 互转

**Files:**
- Create: `features/articles/domain/htmlProjection.ts`
- Test: `features/articles/domain/htmlProjection.test.ts`

**Interfaces:**
- Consumes: `createArticleExtensions()`。
- Produces:
  - `htmlToContentJson(html: string): JSONContent`
  - `contentJsonToHtml(json: JSONContent): string`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentJsonToHtml, htmlToContentJson } from './htmlProjection.ts';

test('旧 HTML 懒迁移成 doc，再投影回标题文本', () => {
  const json = htmlToContentJson('<h2>修谱缘起</h2><p>吾族迁居。</p>');
  assert.equal(json.type, 'doc');
  const html = contentJsonToHtml(json);
  assert.match(html, /修谱缘起/);
  assert.match(html, /吾族迁居/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test features/articles/domain/htmlProjection.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: Write minimal implementation**

```ts
import { generateHTML, generateJSON, type JSONContent } from '@tiptap/core';
import { createArticleExtensions } from '../extensions/createArticleExtensions';

export function htmlToContentJson(html: string): JSONContent {
  return generateJSON(html || '<p></p>', createArticleExtensions());
}

export function contentJsonToHtml(json: JSONContent): string {
  return generateHTML(json, createArticleExtensions());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test features/articles/domain/htmlProjection.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add features/articles/domain/htmlProjection.ts features/articles/domain/htmlProjection.test.ts
git commit -m "feat: 提供谱文 HTML 与 AST 的双向投影"
```

---

### Task 6: 图片只存 assetId

**Files:**
- Create: `features/articles/domain/figureAttrs.ts`
- Create: `features/articles/domain/persistableContent.ts`
- Create: `features/articles/assets/articleAssetStore.ts`
- Test: `features/articles/domain/figureAttrs.test.ts`
- Test: `features/articles/assets/articleAssetStore.test.ts`

**Interfaces:**
- Consumes: `JSONContent`。
- Produces:
  - `normalizeFigureAttrs(input): { assetId: string; caption: string; widthPct: number; align: 'left' | 'center' | 'right' }`
  - `persistableContentJson(json: JSONContent): JSONContent`
  - `ArticleAssetRecord = { assetId: string; contentType: string; bytes: Uint8Array }`
  - `ArticleAssetStore = { put(record): Promise<void>; get(assetId: string): Promise<ArticleAssetRecord | null> }`
  - `createMemoryArticleAssetStore()`
  - `createIndexedDbArticleAssetStore()`

- [ ] **Step 1: Write the failing test**

`features/articles/domain/figureAttrs.test.ts`：

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeFigureAttrs } from './figureAttrs.ts';
import { persistableContentJson } from './persistableContent.ts';

test('拒绝 Base64，并夹取宽度', () => {
  assert.throws(
    () => normalizeFigureAttrs({ assetId: 'a1', src: 'data:image/png;base64,aaaa' }),
    /Base64/,
  );
  const attrs = normalizeFigureAttrs({
    assetId: 'a1',
    caption: '碑拓',
    widthPct: 140,
    align: 'left',
  });
  assert.equal(attrs.widthPct, 100);
  assert.equal(attrs.align, 'left');
});

test('落库 JSON 去掉 blob 和 data src', () => {
  const next = persistableContentJson({
    type: 'doc',
    content: [
      {
        type: 'figureImage',
        attrs: { assetId: 'a1', src: 'blob:http://local/1', caption: '图' },
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '正文' }],
      },
    ],
  });
  assert.equal(next.content?.[0]?.attrs?.src, null);
  assert.equal(next.content?.[0]?.attrs?.assetId, 'a1');
  assert.equal(next.content?.[1]?.content?.[0]?.text, '正文');
});
```

`features/articles/assets/articleAssetStore.test.ts`：

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMemoryArticleAssetStore } from './articleAssetStore.ts';

test('内存图库按 assetId 读写', async () => {
  const store = createMemoryArticleAssetStore();
  await store.put({
    assetId: 'a1',
    contentType: 'image/png',
    bytes: new Uint8Array([1, 2, 3]),
  });
  const found = await store.get('a1');
  assert.equal(found?.contentType, 'image/png');
  assert.deepEqual(found?.bytes, new Uint8Array([1, 2, 3]));
  assert.equal(await store.get('missing'), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test features/articles/domain/figureAttrs.test.ts features/articles/assets/articleAssetStore.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: Write minimal implementation**

`features/articles/domain/figureAttrs.ts`：

```ts
export interface FigureAttrs {
  assetId: string;
  caption: string;
  widthPct: number;
  align: 'left' | 'center' | 'right';
}

export function normalizeFigureAttrs(input: {
  assetId?: string;
  src?: string;
  caption?: string;
  widthPct?: number;
  align?: string;
}): FigureAttrs {
  if ((input.src ?? '').startsWith('data:')) {
    throw new Error('谱文图片禁止内联 Base64');
  }
  const assetId = (input.assetId ?? '').trim();
  if (!assetId) throw new Error('谱文图片必须有 assetId');
  const width = Number.isFinite(input.widthPct) ? Number(input.widthPct) : 80;
  const align = input.align === 'left' || input.align === 'right' ? input.align : 'center';
  return {
    assetId,
    caption: input.caption ?? '',
    widthPct: Math.min(100, Math.max(20, Math.round(width))),
    align,
  };
}
```

`features/articles/domain/persistableContent.ts`：

```ts
import type { JSONContent } from '@tiptap/core';

function cloneNode(node: JSONContent): JSONContent {
  const next: JSONContent = { ...node, attrs: node.attrs ? { ...node.attrs } : undefined };
  if (next.type === 'figureImage' && next.attrs) {
    const src = String(next.attrs.src ?? '');
    if (!src.startsWith('http://') && !src.startsWith('https://')) {
      next.attrs.src = null;
    }
  }
  if (node.content) next.content = node.content.map(cloneNode);
  return next;
}

export function persistableContentJson(json: JSONContent): JSONContent {
  return cloneNode(json);
}
```

`features/articles/assets/articleAssetStore.ts`：

```ts
export interface ArticleAssetRecord {
  assetId: string;
  contentType: string;
  bytes: Uint8Array;
}

export interface ArticleAssetStore {
  put(record: ArticleAssetRecord): Promise<void>;
  get(assetId: string): Promise<ArticleAssetRecord | null>;
}

export function createMemoryArticleAssetStore(): ArticleAssetStore {
  const map = new Map<string, ArticleAssetRecord>();
  return {
    async put(record) {
      map.set(record.assetId, {
        assetId: record.assetId,
        contentType: record.contentType,
        bytes: new Uint8Array(record.bytes),
      });
    },
    async get(assetId) {
      return map.get(assetId) ?? null;
    },
  };
}

const DB_NAME = 'yunpu_article_assets';
const STORE = 'blobs';

export function createIndexedDbArticleAssetStore(): ArticleAssetStore {
  const open = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

  return {
    async put(record) {
      const db = await open();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(
          { contentType: record.contentType, bytes: record.bytes },
          record.assetId,
        );
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    async get(assetId) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(assetId);
        req.onsuccess = () => {
          const value = req.result as { contentType: string; bytes: Uint8Array } | undefined;
          resolve(value ? { assetId, contentType: value.contentType, bytes: value.bytes } : null);
        };
        req.onerror = () => reject(req.error);
      });
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test features/articles/domain/figureAttrs.test.ts features/articles/assets/articleAssetStore.test.ts`

Expected: PASS。IndexedDB 实现不在 bun 单测里打开，只由编辑器在浏览器里调用。

- [ ] **Step 5: Commit**

```bash
git add features/articles/domain/figureAttrs.ts features/articles/domain/figureAttrs.test.ts features/articles/domain/persistableContent.ts features/articles/assets/articleAssetStore.ts features/articles/assets/articleAssetStore.test.ts
git commit -m "feat: 谱文图片只保存 assetId"
```

---

### Task 7: 八个文体模板，种子数据改为委托

**Files:**
- Create: `features/articles/domain/articleTemplates.ts`
- Modify: `features/articles/articleData.ts`
- Test: `features/articles/domain/articleTemplates.test.ts`

**Interfaces:**
- Consumes: `ProjectArticleSeedContext`、`ArticleDocType`、`formatPlacePath`。
- Produces:
  - `ArticleTemplate = { id: string; docType: ArticleDocType; name: string; description: string; defaultSubtitle: string; buildContent: (ctx: ProjectArticleSeedContext) => string }`
  - `ARTICLE_TEMPLATES: ArticleTemplate[]`
  - `getArticleTemplate(id: string): ArticleTemplate | undefined`
  - 模板 id：`blank`、`preface`、`rules`、`origin`、`motto`、`biography`、`inscription`、`donors`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInitialArticleSeed } from '../articleData.ts';
import { ARTICLE_TEMPLATES, getArticleTemplate } from './articleTemplates.ts';

const ctx = {
  familyName: '陈氏',
  surname: '陈',
  hallName: '德星堂',
  ancestor: '陈伯温',
  region: null,
};

test('八个模板都能生成非空正文', () => {
  assert.equal(ARTICLE_TEMPLATES.length, 8);
  for (const template of ARTICLE_TEMPLATES) {
    const html = template.buildContent(ctx);
    assert.equal(html.includes('<'), true, template.id);
  }
  assert.equal(getArticleTemplate('donors')?.name, '捐资芳名录');
  assert.equal(getArticleTemplate('blank')?.buildContent(ctx), '<p></p>');
});

test('种子谱文改为模板投影并带上文体', () => {
  const seed = createInitialArticleSeed('proj-1', ctx);
  const preface = seed.articles['proj-1::article-preface'];
  assert.equal(preface.docType, 'preface');
  assert.equal(preface.status, 'draft');
  assert.equal(preface.privacy, 'clan');
  assert.equal(preface.version, 1);
  assert.equal(preface.contentJson?.type, 'doc');
  assert.match(preface.contentHtml, /修谱缘起/);
  assert.ok(preface.wordCount > 20);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test features/articles/domain/articleTemplates.test.ts`

Expected: FAIL，模板模块不存在；现有 `ArticleDocument` 也还没有在 `createInitialArticleSeed` 里赋值。

- [ ] **Step 3: Write minimal implementation**

创建 `features/articles/domain/articleTemplates.ts`。六个旧模板的 HTML 必须从 `features/articles/articleData.ts` 现有 `makeDoc(...)` 字符串原样搬入，只把插值变量改成函数参数。空白和捐资是新增字符串。

```ts
import { formatPlacePath } from '../../place-input';
import type { ArticleDocType, ProjectArticleSeedContext } from '../types';

export interface ArticleTemplate {
  id: string;
  docType: ArticleDocType;
  name: string;
  description: string;
  defaultSubtitle: string;
  buildContent: (ctx: ProjectArticleSeedContext) => string;
}

function names(ctx: ProjectArticleSeedContext) {
  const familyName = ctx.familyName?.trim() || '本族';
  const surname = ctx.surname?.trim() || '宗';
  const hallName = ctx.hallName?.trim() || `${surname}氏宗堂`;
  const ancestor = ctx.ancestor?.trim() || `${surname}氏始迁祖`;
  const region = formatPlacePath(ctx.region, ' ') || '故里原籍';
  return { familyName, surname, hallName, ancestor, region };
}

export const ARTICLE_TEMPLATES: ArticleTemplate[] = [
  {
    id: 'blank',
    docType: 'custom',
    name: '空白谱文',
    description: '从空段落开始撰写。',
    defaultSubtitle: '',
    buildContent: () => '<p></p>',
  },
  {
    id: 'preface',
    docType: 'preface',
    name: '重修谱序',
    description: '卷首谱序，说明修谱缘起与宗旨。',
    defaultSubtitle: '卷首 · 重修谱序',
    buildContent: (ctx) => {
      const { familyName, hallName, ancestor, region } = names(ctx);
      return `<h2>一、修谱缘起</h2>
<p>夫木有本而枝叶茂，水有源而流泽长；人有祖而后世系明，族有谱而亲疏序。吾族${familyName}，以「${hallName}」为堂号，自始迁祖${ancestor}公择居${region}以来，耕读传家，瓜瓞绵延，迄今已历数世。</p>
<blockquote><p>「盛世修志，旺族修谱。」谱牒之设，非徒纪名讳、辨昭穆而已，实欲使后世子孙知所从来，明孝悌之义，敦睦宗族之情。</p></blockquote>
<h2>二、本次重修宗旨</h2>
<p>岁月既久，旧谱残佚堪虞，加之近年宗亲迁徙四方，生卒婚配亟待续录。今由族中贤达共议，依托云谱数字修谱平台汇辑旧闻、采录新丁，务求世系清晰、传记翔实、体例谨严，俾千秋百代之后，展卷而知本源，开帙而见先风。</p>
<hr />
<p style="text-align: right">岁次重修之时 · ${hallName}谨识</p>`;
    },
  },
  {
    id: 'rules',
    docType: 'rules',
    name: '修谱凡例',
    description: '收录范围、字辈和著录体例。',
    defaultSubtitle: '卷首 · 编修体例与收录规范',
    buildContent: (ctx) => {
      const { ancestor } = names(ctx);
      return `<h2>编修总则</h2>
<ol>
  <li><p><strong>尊祖敬宗，详近略远</strong>：凡本支一脉，自${ancestor}公起为一世，依代次顺列，远祖源流则另立专篇考述，以免附会。</p></li>
  <li><p><strong>男女并录，一视同仁</strong>：新时代修谱秉持男女平等之义，凡本族子女及配偶均按实录入名讳、字辈与生平纪略。</p></li>
  <li><p><strong>秉笔直书，信以传信</strong>：生卒年月、配娶氏族、迁徙地名及葬地坟向，均以核实为准；存疑之处注明「待考」，绝不臆造。</p></li>
</ol>
<h2>字辈与体例对照示例</h2>
<table>
  <tbody>
    <tr><th>项目</th><th>编修规范说明</th><th>著录示例</th></tr>
    <tr><td>名讳与字号</td><td>正名居首，字、号附后，曾用名可另注</td><td>讳宗文，字伯章，号竹溪</td></tr>
    <tr><td>生卒纪年</td><td>优先采用公历，亦可并注农历与干支</td><td>生于一九三二年壬申十月</td></tr>
    <tr><td>世次行第</td><td>标明第几世及兄弟姐妹长幼排行</td><td>五世 · 长子 / 次女</td></tr>
  </tbody>
</table>`;
    },
  },
  {
    id: 'origin',
    docType: 'origin',
    name: '姓氏源流',
    description: '得姓与本支迁徙。',
    defaultSubtitle: '卷一 · 受姓源流与迁徙沿革',
    buildContent: (ctx) => {
      const { surname, hallName, ancestor, region } = names(ctx);
      return `<h2>一、得姓之始</h2>
<p>${surname}姓源远流长，历代郡望堂号播迁有序，本支素重「${hallName}」渊源。自上古受姓以来，历秦汉魏晋唐宋元明清各代，先祖多以礼法传家、忠信立身，散居大江南北。</p>
<h2>二、本支迁徙脉络</h2>
<p>据旧谱残卷及地方志乘所载，本支先祖自中原南渡或北迁，辗转徙居${region}。${ancestor}公相度山川形胜，见此地土沃泉甘、风俗淳厚，遂筑室定居，开基立业，是为本族一世之祖。</p>
<ul>
  <li><p><strong>立基创业期</strong>：${ancestor}公躬耕力行，兴修田庐，奠定家族生计基础。</p></li>
  <li><p><strong>分房衍派期</strong>：传至三世、四世之后，支派渐繁，分居邻邑各村落，仍岁时祭扫不辍。</p></li>
</ul>`;
    },
  },
  {
    id: 'motto',
    docType: 'motto',
    name: '祖训家规',
    description: '家训十条。',
    defaultSubtitle: '卷二 · 传家训诫',
    buildContent: () => `<blockquote><p>「积善之家，必有余庆；诗书传家，其泽乃长。」</p></blockquote>
<ol>
  <li><p><strong>孝顺父母</strong>：晨昏定省，生养死葬皆尽其诚，毋违尊长教诲。</p></li>
  <li><p><strong>友爱手足</strong>：同气连枝，患难相恤，切忌因财帛细故伤及骨肉之情。</p></li>
  <li><p><strong>敬宗睦族</strong>：凡我宗亲，无论贫富贵贱，皆一祖之遗脉，当彼此扶持。</p></li>
  <li><p><strong>崇尚诗书</strong>：无论农工商贾，皆宜督课子弟读书明理，知书则礼义自明。</p></li>
  <li><p><strong>勤俭持家</strong>：一粥一饭当思来处不易，戒奢靡，尚朴素。</p></li>
  <li><p><strong>诚信立世</strong>：言必信，行必果，商贾交易尤重仁义。</p></li>
  <li><p><strong>奉公守法</strong>：谨守国法乡约，安分守己，勿作非分之想。</p></li>
  <li><p><strong>慎终追远</strong>：清明冬至祭扫祖茔，不可怠废先人祀典。</p></li>
</ol>`,
  },
  {
    id: 'biography',
    docType: 'biography',
    name: '人物传略',
    description: '以始迁祖或所选人物起稿。P0 只用项目里的始迁祖姓名。',
    defaultSubtitle: '卷三 · 人物传记',
    buildContent: (ctx) => {
      const { ancestor, region } = names(ctx);
      return `<h2>生平概略</h2>
<p>${ancestor}公，乃本支一世始迁祖。公生性敦厚，少时勤勉好学，长而精于耕读营生。值世道迁变之际，公携眷属迁徙至${region}，披荆斩棘，兴建屋宇，敦睦乡邻，遂开本族百年基业。</p>
<h3>品行与遗泽</h3>
<p>公尝谓子孙曰：「做人以诚为本，立业以勤为先。财帛可散，惟忠厚与诗书不可废。」乡人感其德行，每有纷争多请公居间排解，皆心悦诚服而去。</p>`;
    },
  },
  {
    id: 'inscription',
    docType: 'inscription',
    name: '宗祠碑记',
    description: '碑记与艺文选存。',
    defaultSubtitle: '卷三 · 碑刻铭文与诗词选存',
    buildContent: (ctx) => {
      const { hallName } = names(ctx);
      return `<h2 style="text-align: center">${hallName}宗祠重修记</h2>
<p>维岁序更新，宗亲合力修葺祖祠。栋宇既崇，丹楹刻桷，非徒壮观瞻也，实以安先灵、聚宗情、垂典范于后昆。祠内正厅悬「${hallName}」匾额，左列昭穆世系，右刻祖训家规，凡入斯堂者，当肃然起敬，思先人之劳苦，勉今日之奋发。</p>
<hr />
<h3 style="text-align: center">宗谱告成偶成</h3>
<p style="text-align: center">一脉相承数百秋，山高水长溯源流。</p>
<p style="text-align: center">枝繁叶茂今重记，长使清芬万古留。</p>`;
    },
  },
  {
    id: 'donors',
    docType: 'custom',
    name: '捐资芳名录',
    description: '按金额或事项登录捐资族亲。',
    defaultSubtitle: '附录 · 捐资芳名',
    buildContent: (ctx) => {
      const { hallName } = names(ctx);
      return `<h2>${hallName}重修捐资芳名</h2>
<p>凡乐输资金、物资或劳务者，依实名登录，不以多寡分亲疏。</p>
<table>
  <tbody>
    <tr><th>芳名</th><th>支派</th><th>事项</th><th>金额或物资</th></tr>
    <tr><td></td><td></td><td>修祠</td><td></td></tr>
  </tbody>
</table>`;
    },
  },
];

export function getArticleTemplate(id: string): ArticleTemplate | undefined {
  return ARTICLE_TEMPLATES.find((item) => item.id === id);
}
```

把 `createInitialArticleSeed` 里的 `makeDoc` 和六段手写 HTML 删掉。树结构、六个固定 id 和 `defaultSelectedId: prefaceId` 保持不变。文档改为：

```ts
import { getArticleTemplate } from './domain/articleTemplates';
import { extractArticleMetrics } from './domain/articleMetrics';
import { contentJsonToHtml, htmlToContentJson } from './domain/htmlProjection';

// 在 timestamp 之后：
const templateIds: Array<{ articleId: string; templateId: string; title: string; subtitle: string; author: string }> = [
  { articleId: prefaceId, templateId: 'preface', title: '重修族谱序', subtitle: `卷首 · ${familyName}重修谱序`, author: `${hallName}修谱编委会` },
  { articleId: rulesId, templateId: 'rules', title: '修谱凡例', subtitle: '卷首 · 编修体例与收录规范', author: `${hallName}修谱编委会` },
  { articleId: originId, templateId: 'origin', title: `${surname}氏得姓源流考`, subtitle: `卷一 · ${surname}氏受姓源流与迁徙沿革`, author: '谱牒文献考订组' },
  { articleId: mottoId, templateId: 'motto', title: '祖训家规十条', subtitle: `卷二 · ${hallName}传家训诫`, author: '先祖遗训辑录' },
  { articleId: biographyId, templateId: 'biography', title: `${ancestor}公传略`, subtitle: '卷三 · 人物传记', author: `${hallName}编委会` },
  { articleId: inscriptionId, templateId: 'inscription', title: '宗祠碑记与艺文录', subtitle: '卷三 · 碑刻铭文与诗词选存', author: '艺文辑录组' },
];

const articles: Record<string, ArticleDocument> = {};
for (const item of templateIds) {
  const template = getArticleTemplate(item.templateId);
  if (!template) continue;
  const contentJson = htmlToContentJson(template.buildContent(ctx));
  const metrics = extractArticleMetrics(contentJson);
  articles[makeArticleStorageKey(projectId, item.articleId)] = {
    id: item.articleId,
    title: item.title,
    subtitle: item.subtitle,
    author: item.author,
    docType: template.docType,
    status: 'draft',
    privacy: 'clan',
    contentJson,
    contentHtml: contentJsonToHtml(contentJson),
    linkedPersonIds: metrics.linkedPersonIds,
    linkedChartIds: metrics.linkedChartIds,
    citations: [],
    version: 1,
    wordCount: metrics.wordCount,
    updatedAt: timestamp,
  };
}
```

`computeWordCount` 仍留在 `articleData.ts`，谱书编译还在用它。

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test features/articles/domain/articleTemplates.test.ts`

Expected: PASS，且 `contentHtml` 含 `修谱缘起`。

- [ ] **Step 5: Commit**

```bash
git add features/articles/domain/articleTemplates.ts features/articles/domain/articleTemplates.test.ts features/articles/articleData.ts
git commit -m "feat: 用同一套文体模板生成谱文种子"
```

---

### Task 8: Store 写入派生字段并升到 persist v2

**Files:**
- Modify: `store/useArticleStore.ts`
- Test: `features/articles/domain/articleCommit.test.ts`

**Interfaces:**
- Consumes: `extractArticleMetrics`、`contentJsonToHtml`、`persistableContentJson`、`migrateArticlesV1ToV2`。
- Produces: `commitArticleContent(existing: ArticleDocument | undefined, articleId: string, updates: ArticleMetaInput & { contentJson?: JSONContent; contentHtml?: string }, updatedAt: string): ArticleDocument`

`updateArticleContent` 改为调用 `commitArticleContent`。传入 `contentJson` 时忽略外部 `contentHtml`，用投影结果覆盖，并把 `version` 加 1。只改标题时保留原 `contentJson`，同样把 `version` 加 1。

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ArticleDocument } from '../types';
import { commitArticleContent } from './articleCommit.ts';

const existing: ArticleDocument = {
  id: 'a1',
  title: '旧题',
  subtitle: '',
  author: '',
  docType: 'custom',
  status: 'draft',
  privacy: 'clan',
  contentHtml: '<p>旧</p>',
  linkedPersonIds: [],
  linkedChartIds: [],
  citations: [],
  version: 3,
  wordCount: 1,
  updatedAt: '2024-01-01 00:00',
};

test('提交 AST 时派生 HTML 和字数，并递增版本', () => {
  const next = commitArticleContent(existing, 'a1', {
    title: '新题',
    contentJson: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '新正文' }],
        },
      ],
    },
  }, '2026-11-24 12:00');
  assert.equal(next.title, '新题');
  assert.equal(next.version, 4);
  assert.equal(next.wordCount, 3);
  assert.match(next.contentHtml, /新正文/);
  assert.equal(next.docType, 'custom');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test features/articles/domain/articleCommit.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: Write minimal implementation**

`features/articles/domain/articleCommit.ts`：

```ts
import type { JSONContent } from '@tiptap/core';
import type { ArticleDocument, ArticleMetaInput } from '../types';
import { computeWordCount } from '../articleData';
import { extractArticleMetrics } from './articleMetrics';
import { contentJsonToHtml } from './htmlProjection';
import { persistableContentJson } from './persistableContent';

export function commitArticleContent(
  existing: ArticleDocument | undefined,
  articleId: string,
  updates: ArticleMetaInput & { contentJson?: JSONContent; contentHtml?: string },
  updatedAt: string,
): ArticleDocument {
  const contentJson = updates.contentJson
    ? persistableContentJson(updates.contentJson)
    : existing?.contentJson;
  const metrics = contentJson ? extractArticleMetrics(contentJson) : null;
  const contentHtml = contentJson
    ? contentJsonToHtml(contentJson)
    : updates.contentHtml ?? existing?.contentHtml ?? '<p></p>';
  return {
    id: articleId,
    title: updates.title ?? existing?.title ?? '未命名谱文',
    subtitle: updates.subtitle ?? existing?.subtitle ?? '',
    author: updates.author ?? existing?.author ?? '',
    docType: updates.docType ?? existing?.docType ?? 'custom',
    status: existing?.status ?? 'draft',
    privacy: existing?.privacy ?? 'clan',
    contentJson,
    contentHtml,
    linkedPersonIds: metrics?.linkedPersonIds ?? existing?.linkedPersonIds ?? [],
    linkedChartIds: metrics?.linkedChartIds ?? existing?.linkedChartIds ?? [],
    citations: existing?.citations ?? [],
    version: (existing?.version ?? 0) + 1,
    wordCount: metrics?.wordCount ?? computeWordCount(contentHtml),
    updatedAt,
  };
}
```

在 `useArticleStore.ts` 里：

- `persist` 的 `version` 改为 `2`。
- 增加 `migrate: (persisted, version) => (version < 2 ? migrateArticlesV1ToV2(persisted) : persisted)`。
- `updateArticleContent` 的 updates 类型改为 `ArticleMetaInput & { contentJson?: JSONContent; contentHtml?: string }`。
- 用 `commitArticleContent(existing, articleId, updates, formatNowTimestamp())` 替换现在手写的 `nextDoc`。树标题同步逻辑保持原样。
- `addArticle` 在构造文档时调用 `commitArticleContent(undefined, id, { title, subtitle, author, docType: meta?.docType, contentHtml: meta?.contentHtml, contentJson: meta?.contentJson ?? (meta?.contentHtml ? htmlToContentJson(meta.contentHtml) : htmlToContentJson(`<p>请在此处开始撰写「${title}」正文内容……</p>`)) }, formatNowTimestamp())`。因为 `commitArticleContent` 在 `existing` 为空时会把 version 设为 1，这里符合新文档。
- `updateArticleMeta`、`renameNode`、`duplicateNode` 必须保留新字段：在现有对象上展开 `...existing`，只改标题或时间，并把 `version` 加 1。不要再手写一个只含六个旧字段的对象。

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test features/articles/domain/articleCommit.test.ts && bun run lint`

Expected: 测试 PASS。`lint` 若因 `ArticlesPage.tsx` 的兜底对象缺字段失败，在 Task 12 修完前，先把该兜底对象补上 `docType: 'custom'`、`status: 'draft'`、`privacy: 'clan'`、`linkedPersonIds: []`、`linkedChartIds: []`、`citations: []`、`version: 1`，让本任务的 lint 通过。

- [ ] **Step 5: Commit**

```bash
git add features/articles/domain/articleCommit.ts features/articles/domain/articleCommit.test.ts store/useArticleStore.ts features/articles/pages/ArticlesPage.tsx
git commit -m "feat: 谱文保存改为提交 AST 并迁移到 persist v2"
```

---

### Task 9: 800ms 防抖，并去掉假页码

**Files:**
- Create: `features/articles/domain/articleSaveQueue.ts`
- Modify: `features/articles/components/WordArticleEditor.tsx`
- Test: `features/articles/domain/articleSaveQueue.test.ts`

**Interfaces:**
- Consumes: `extractArticleMetrics`、`contentJsonToHtml`、`persistableContentJson`。
- Produces:
  - `ArticleSaveCommit = { articleId: string; contentJson: JSONContent; contentHtml: string; wordCount: number; paragraphCount: number; linkedPersonIds: string[]; linkedChartIds: string[] }`
  - `createArticleSaveQueue(options: { delayMs: number; schedule: (fn: () => void, ms: number) => number; cancel: (handle: number) => void; projectHtml: (json: JSONContent) => string; onCommit: (commit: ArticleSaveCommit) => void }): { noteEdit: (articleId: string, readJson: () => JSONContent) => void; flush: () => ArticleSaveCommit | null; dispose: () => void }`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { JSONContent } from '@tiptap/core';
import { createArticleSaveQueue } from './articleSaveQueue.ts';

test('连续编辑只在定时器触发时提交一次', () => {
  const commits: string[] = [];
  let scheduled: (() => void) | null = null;
  const queue = createArticleSaveQueue({
    delayMs: 800,
    schedule: (fn) => {
      scheduled = fn;
      return 1;
    },
    cancel: () => {
      scheduled = null;
    },
    projectHtml: () => '<p>乙</p>',
    onCommit: (commit) => commits.push(commit.contentHtml),
  });
  const first: JSONContent = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '甲' }] }] };
  const second: JSONContent = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '乙' }] }] };
  queue.noteEdit('a1', () => first);
  queue.noteEdit('a1', () => second);
  assert.equal(commits.length, 0);
  assert.ok(scheduled);
  scheduled!();
  assert.deepEqual(commits, ['<p>乙</p>']);
});

test('flush 立即提交并取消定时器', () => {
  const commits: number[] = [];
  let scheduled: (() => void) | null = null;
  const queue = createArticleSaveQueue({
    delayMs: 800,
    schedule: (fn) => {
      scheduled = fn;
      return 7;
    },
    cancel: () => {
      scheduled = null;
    },
    projectHtml: () => '<p>谱</p>',
    onCommit: (commit) => commits.push(commit.wordCount),
  });
  queue.noteEdit('a1', () => ({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: '谱' }] }],
  }));
  queue.flush();
  assert.deepEqual(commits, [1]);
  assert.equal(scheduled, null);
  assert.equal(queue.flush(), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test features/articles/domain/articleSaveQueue.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: Write minimal implementation**

`features/articles/domain/articleSaveQueue.ts`：

```ts
import type { JSONContent } from '@tiptap/core';
import { extractArticleMetrics } from './articleMetrics';
import { persistableContentJson } from './persistableContent';

export interface ArticleSaveCommit {
  articleId: string;
  contentJson: JSONContent;
  contentHtml: string;
  wordCount: number;
  paragraphCount: number;
  linkedPersonIds: string[];
  linkedChartIds: string[];
}

export function createArticleSaveQueue(options: {
  delayMs: number;
  schedule: (fn: () => void, ms: number) => number;
  cancel: (handle: number) => void;
  projectHtml: (json: JSONContent) => string;
  onCommit: (commit: ArticleSaveCommit) => void;
}) {
  let timer: number | null = null;
  let pending: { articleId: string; readJson: () => JSONContent } | null = null;

  const clearTimer = () => {
    if (timer !== null) {
      options.cancel(timer);
      timer = null;
    }
  };

  const emit = (): ArticleSaveCommit | null => {
    if (!pending) return null;
    const current = pending;
    pending = null;
    const contentJson = persistableContentJson(current.readJson());
    const metrics = extractArticleMetrics(contentJson);
    const commit: ArticleSaveCommit = {
      articleId: current.articleId,
      contentJson,
      contentHtml: options.projectHtml(contentJson),
      wordCount: metrics.wordCount,
      paragraphCount: metrics.paragraphCount,
      linkedPersonIds: metrics.linkedPersonIds,
      linkedChartIds: metrics.linkedChartIds,
    };
    options.onCommit(commit);
    return commit;
  };

  return {
    noteEdit(articleId: string, readJson: () => JSONContent) {
      pending = { articleId, readJson };
      clearTimer();
      timer = options.schedule(() => {
        timer = null;
        emit();
      }, options.delayMs);
    },
    flush() {
      clearTimer();
      return emit();
    },
    dispose() {
      clearTimer();
      pending = null;
    },
  };
}
```

修改 `WordArticleEditor.tsx`：

- `useEditor` 的 `extensions` 改为 `createArticleExtensions()`。
- 删除 `saveTimerRef` 以及 `onUpdate` 里对 `onUpdateRef.current({ contentHtml })` 的调用。
- 增加 `saveQueueRef`。队列的 `onCommit` 调用 `onUpdateArticle({ contentJson: commit.contentJson })`。`projectHtml` 使用 `contentJsonToHtml`。`schedule` / `cancel` 使用 `window.setTimeout` / `window.clearTimeout`。`delayMs` 为 `800`。
- `onUpdate` 只做 `setSaveState('saving')` 和 `saveQueueRef.current.noteEdit(activeArticleIdRef.current, () => ed.getJSON())`。队列提交回调里 `setSaveState('saved')`。
- 初始内容：`article.contentJson ?? article.contentHtml`。
- 切换 `article.id` 之前先 `flush()`。切换时若 `contentJson` 为空，调用 `htmlToContentJson(article.contentHtml)` 后立刻 `onUpdateArticle({ contentJson })`，这是首次打开的懒迁移，不等待 800ms。
- `useEffect` 清理函数调用 `dispose()` 前先 `flush()`。
- 注册 `beforeunload`：有未保存队列时调用 `flush()`。
- 进入预览前调用 `flush()`。
- 删除 `estimatedPages`。页脚第二格改为 `{article.wordCount} 字 · {paragraphCount} 段 · {readingTimeLabel(article.wordCount)}`。底栏删除 `约 {estimatedPages} 页`。段落数优先用 `extractArticleMetrics(article.contentJson).paragraphCount`；没有 JSON 时再用现有 HTML 标签计数。
- `onUpdateArticle` 的类型改为接受 `contentJson`。

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test features/articles/domain/articleSaveQueue.test.ts && bun run lint`

Expected: PASS。在编辑器里确认 `onUpdate` 不再出现 `getHTML()` 后立即调用 `onUpdateArticle`。

- [ ] **Step 5: Commit**

```bash
git add features/articles/domain/articleSaveQueue.ts features/articles/domain/articleSaveQueue.test.ts features/articles/components/WordArticleEditor.tsx
git commit -m "fix: 谱文正文 800ms 后才落库并去掉假页码"
```

---

### Task 10: 赫蹏排版与现代 / 仿古主题

**Files:**
- Create: `features/articles/styles/puwen-prose.css`
- Modify: `index.css`
- Modify: `features/articles/components/WordArticleEditor.tsx`

**Interfaces:**
- Consumes: 编辑器根节点 class `article-word-prose`。
- Produces: 纸页元素 `data-theme="modern" | "classic"`。预览工具栏增加「现代」「仿古」两个按钮，只改 `data-theme`。

- [ ] **Step 1: Write the failing test**

本任务是样式。用一个纯函数锁定主题值，避免组件测试基础设施。

`features/articles/domain/articleTheme.test.ts`：

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextArticleTheme } from './articleTheme.ts';

test('主题只在 modern 和 classic 之间切换', () => {
  assert.equal(nextArticleTheme('modern'), 'classic');
  assert.equal(nextArticleTheme('classic'), 'modern');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test features/articles/domain/articleTheme.test.ts`

Expected: FAIL。

- [ ] **Step 3: Write minimal implementation**

```ts
export type ArticleTheme = 'modern' | 'classic';

export function nextArticleTheme(theme: ArticleTheme): ArticleTheme {
  return theme === 'modern' ? 'classic' : 'modern';
}
```

把 `index.css` 第 321–448 行的 `.article-word-prose` 规则剪切到 `features/articles/styles/puwen-prose.css`，并在文件头部追加：

```css
.article-word-prose {
  font-family: 'Noto Serif SC', 'Songti SC', 'SimSun', 'STSong', Georgia, serif;
  font-size: 16px;
  line-height: 1.85;
  text-spacing-trim: space-all;
  hanging-punctuation: allow-end;
}

.article-word-prose p {
  text-indent: 2em;
}

.article-word-prose h1,
.article-word-prose h2,
.article-word-prose h3,
.article-word-prose li p,
.article-word-prose blockquote p {
  text-indent: 0;
}

.article-word-prose .puwen-figure {
  margin: 1.2em auto;
  text-align: center;
}

.article-word-prose .puwen-figure img {
  max-width: 100%;
  height: auto;
}

.article-word-prose .puwen-figure figcaption {
  margin-top: 0.4em;
  font-size: 0.86em;
  text-indent: 0;
}

.article-word-prose .puwen-interlinear {
  display: inline-grid;
  grid-template-rows: 1fr 1fr;
  font-size: 0.55em;
  line-height: 1.15;
  vertical-align: middle;
  text-indent: 0;
}

.article-word-prose[data-theme='classic'] {
  color: #2b2118;
  background-image: linear-gradient(#8c2d25, #8c2d25), linear-gradient(#8c2d25, #8c2d25);
  background-size: 1px 100%, 1px 100%;
  background-position: 0 0, 100% 0;
  background-repeat: no-repeat;
  padding-inline: 1.2em;
}

.article-word-prose[data-theme='classic'] p[style*='text-align: center'],
.article-word-prose[data-theme='classic'] h1,
.article-word-prose[data-theme='classic'] h2 {
  text-indent: 0;
  text-align: center;
}
```

原有表格、标题、引用规则保留在同一文件，不删。`index.css` 的 `@media print` 留在原处。

`WordArticleEditor.tsx` 顶部 `import '../styles/puwen-prose.css'`。纸页 `article` 增加 `data-theme={theme}`。编辑器 `editorProps.attributes` 增加 `data-theme: theme`。`theme` 状态默认 `'modern'`。预览模式工具栏调用 `setTheme(nextArticleTheme(theme))`，按钮文案是当前要切去的名称：「仿古」或「现代」。

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test features/articles/domain/articleTheme.test.ts && bun run lint`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add features/articles/styles/puwen-prose.css features/articles/domain/articleTheme.ts features/articles/domain/articleTheme.test.ts features/articles/components/WordArticleEditor.tsx index.css
git commit -m "feat: 谱文编辑区使用赫蹏排版和双主题"
```

---

### Task 11: 真 docx 导入导出

**Files:**
- Create: `features/articles/domain/docxCodec.ts`
- Modify: `features/articles/components/WordArticleEditor.tsx`
- Modify: `features/articles/components/WordToolbar.tsx`
- Test: `features/articles/domain/docxCodec.test.ts`
- Modify: `package.json`、`bun.lock`

**Interfaces:**
- Consumes: `ArticleDocument` 的 `title`、`subtitle`、`author`、`contentJson`；`ArticleAssetStore`。
- Produces:
  - `sanitizeArticleFileName(title: string): string`，结果以 `.docx` 结尾。
  - `articleJsonToDocxBlocks(json: JSONContent): DocxBlock[]`
  - `tiptapJsonToDocx(article, projectMeta: { hallName?: string }): Document`
  - `importDocxArrayBuffer(arrayBuffer: ArrayBuffer): Promise<{ contentJson: JSONContent; contentHtml: string; images: ArticleAssetRecord[] }>`

`DocxBlock` 是 `{ kind: 'heading' | 'paragraph' | 'blockquote' | 'figure' | 'table'; text: string; level?: 1 | 2 | 3; rows?: string[][] }`。

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import {
  articleJsonToDocxBlocks,
  importDocxArrayBuffer,
  sanitizeArticleFileName,
  tiptapJsonToDocx,
} from './docxCodec.ts';

test('文件名是 docx，块遍历保留标题和人物兜底名', () => {
  assert.equal(sanitizeArticleFileName('重修/族谱'), '重修_族谱.docx');
  const blocks = articleJsonToDocxBlocks({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '谱序' }] },
      {
        type: 'paragraph',
        content: [
          {
            type: 'personMention',
            attrs: { personId: 'p1', chartId: 'c1', fallbackName: '伯温', generation: 1 },
          },
        ],
      },
    ],
  });
  assert.equal(blocks[0]?.text, '谱序');
  assert.equal(blocks[1]?.text, '伯温');
});

test('导出的 docx 是 zip，导入能读回标题', async () => {
  const source = new Document({
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('重修族谱序')] }),
          new Paragraph({ children: [new TextRun('吾族迁居。')] }),
        ],
      },
    ],
  });
  const buffer = await Packer.toBuffer(source);
  assert.equal(buffer[0], 0x50);
  assert.equal(buffer[1], 0x4b);
  const imported = await importDocxArrayBuffer(buffer);
  assert.match(imported.contentHtml, /重修族谱序/);
  assert.match(imported.contentHtml, /吾族迁居/);

  const exported = tiptapJsonToDocx(
    { title: '重修族谱序', subtitle: '卷首', author: '编委会', contentJson: imported.contentJson },
    { hallName: '德星堂' },
  );
  const out = await Packer.toBuffer(exported);
  assert.equal(out[0], 0x50);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test features/articles/domain/docxCodec.test.ts`

Expected: FAIL，模块和依赖都不存在。

- [ ] **Step 3: Write minimal implementation**

Run: `bun add mammoth docx`

创建 `features/articles/domain/docxCodec.ts`：

```ts
import type { JSONContent } from '@tiptap/core';
import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import mammoth from 'mammoth';
import type { ArticleAssetRecord } from '../assets/articleAssetStore';
import { contentJsonToHtml, htmlToContentJson } from './htmlProjection';

export interface DocxBlock {
  kind: 'heading' | 'paragraph' | 'blockquote' | 'figure' | 'table';
  text: string;
  level?: 1 | 2 | 3;
  rows?: string[][];
}

export function sanitizeArticleFileName(title: string): string {
  const safe = (title || '谱文').replace(/[\\/:*?"<>|]/g, '_').trim() || '谱文';
  return `${safe}.docx`;
}

function inlineText(node: JSONContent | null | undefined): string {
  if (!node) return '';
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'personMention') return String(node.attrs?.fallbackName ?? '');
  if (node.type === 'inlineAnnotation') {
    const note = String(node.attrs?.noteText ?? '');
    return note ? `（注：${note}）` : '';
  }
  return (node.content ?? []).map((child) => inlineText(child)).join('');
}

export function articleJsonToDocxBlocks(json: JSONContent): DocxBlock[] {
  const blocks: DocxBlock[] = [];
  const visit = (node: JSONContent) => {
    if (node.type === 'heading') {
      const level = node.attrs?.level;
      blocks.push({
        kind: 'heading',
        level: level === 1 || level === 2 || level === 3 ? level : 1,
        text: inlineText(node),
      });
      return;
    }
    if (node.type === 'blockquote') {
      blocks.push({ kind: 'blockquote', text: inlineText(node) });
      return;
    }
    if (node.type === 'figureImage') {
      blocks.push({ kind: 'figure', text: String(node.attrs?.caption ?? '') });
      return;
    }
    if (node.type === 'table') {
      const rows = (node.content ?? []).map((row) =>
        (row.content ?? []).map((cell) => inlineText(cell)),
      );
      blocks.push({ kind: 'table', text: '', rows });
      return;
    }
    if (node.type === 'paragraph') {
      blocks.push({ kind: 'paragraph', text: inlineText(node) });
      return;
    }
    for (const child of node.content ?? []) visit(child);
  };
  for (const child of json.content ?? []) visit(child);
  return blocks;
}

function headingLevel(level: 1 | 2 | 3 | undefined) {
  if (level === 1) return HeadingLevel.HEADING_1;
  if (level === 3) return HeadingLevel.HEADING_3;
  return HeadingLevel.HEADING_2;
}

export function tiptapJsonToDocx(
  article: { title: string; subtitle?: string; author?: string; contentJson?: JSONContent },
  projectMeta: { hallName?: string },
): Document {
  const blocks = articleJsonToDocxBlocks(article.contentJson ?? { type: 'doc', content: [] });
  const children = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun(article.title || '未命名谱文')],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun([article.subtitle, article.author].filter(Boolean).join(' · '))],
    }),
    ...blocks.map((block) => {
      if (block.kind === 'heading') {
        return new Paragraph({ heading: headingLevel(block.level), children: [new TextRun(block.text)] });
      }
      if (block.kind === 'table') {
        return new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: (block.rows ?? []).map(
            (row) =>
              new TableRow({
                children: row.map(
                  (cell) => new TableCell({ children: [new Paragraph({ children: [new TextRun(cell)] })] }),
                ),
              }),
          ),
        });
      }
      return new Paragraph({ children: [new TextRun(block.text)] });
    }),
  ];
  return new Document({
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [new TextRun([projectMeta.hallName, article.subtitle].filter(Boolean).join(' · '))],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun('第 '),
                  new TextRun({ children: [PageNumber.CURRENT] }),
                  new TextRun(' 页 / 共 '),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES] }),
                  new TextRun(' 页'),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
}

function rewriteAssetImages(json: JSONContent): JSONContent {
  const next: JSONContent = { ...json, attrs: json.attrs ? { ...json.attrs } : undefined };
  const src = String(next.attrs?.src ?? '');
  if (src.startsWith('asset://')) {
    next.type = 'figureImage';
    next.attrs = {
      ...next.attrs,
      assetId: src.slice('asset://'.length),
      src: null,
      caption: String(next.attrs?.caption ?? ''),
      widthPct: next.attrs?.widthPct ?? 80,
      align: next.attrs?.align ?? 'center',
    };
  }
  if (json.content) next.content = json.content.map((child) => rewriteAssetImages(child));
  return next;
}

export async function importDocxArrayBuffer(arrayBuffer: ArrayBuffer): Promise<{
  contentJson: JSONContent;
  contentHtml: string;
  images: ArticleAssetRecord[];
}> {
  const images: ArticleAssetRecord[] = [];
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const buffer = await image.read();
        const assetId = crypto.randomUUID();
        images.push({
          assetId,
          contentType: image.contentType,
          bytes: new Uint8Array(buffer),
        });
        return { src: `asset://${assetId}` };
      }),
    },
  );
  const contentJson = rewriteAssetImages(htmlToContentJson(result.value));
  return { contentJson, contentHtml: contentJsonToHtml(contentJson), images };
}
```

`WordArticleEditor` 删除 `handleExportWord` 的 HTML Blob。改为 async：先 `flush()`，用当前 `contentJson` 或懒迁移结果调用 `tiptapJsonToDocx`，`Packer.toBlob`，下载 `sanitizeArticleFileName(article.title)`。

`WordToolbarProps` 增加 `onImportWord: (file: File) => void`。两处「导出 Word」按钮的 `title` 改为 `导出 Word 文档 (.docx)`。在两处导出按钮前各加一个「导入 Word」按钮，点击隐藏的 `<input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document">`。编辑器收到文件后读 `arrayBuffer()`，调用 `importDocxArrayBuffer`，把图片 `put` 到 `createIndexedDbArticleAssetStore()`，再 `onUpdateArticle({ contentJson })` 并 `editor.commands.setContent(contentJson, false)`。

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test features/articles/domain/docxCodec.test.ts && bun run lint`

Expected: PASS。导出 buffer 以 `PK` 开头，导入 HTML 含「重修族谱序」和「吾族迁居」。下载文件名以 `.docx` 结尾。

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock features/articles/domain/docxCodec.ts features/articles/domain/docxCodec.test.ts features/articles/components/WordArticleEditor.tsx features/articles/components/WordToolbar.tsx
git commit -m "feat: 用标准 docx 替换谱文伪 doc 导出"
```

---

### Task 12: 大纲检查器、模板选择器和卷目徽标

**Files:**
- Create: `features/articles/components/ArticleInspectorPanel.tsx`
- Modify: `features/articles/components/WordArticleEditor.tsx`
- Modify: `features/articles/components/WordToolbar.tsx`
- Modify: `features/articles/components/ArticleMetaModal.tsx`
- Modify: `features/articles/pages/ArticlesPage.tsx`

**Interfaces:**
- Consumes: `ArticleHeading`、`ArticleMetrics`、`ARTICLE_TEMPLATES`、`STATUS_LABELS`、`DOC_TYPE_LABELS`、`readingTimeLabel`。
- Produces: `ArticleInspectorPanel` props `{ headings: ArticleHeading[]; wordCount: number; paragraphCount: number; readingLabel: string; collapsed: boolean; onToggle: () => void }`。`ArticleMetaModal` 的 `onSubmit` 增加 `templateId` 和 `docType`。

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterArticlesByStatus } from '../articleLabels.ts';
import type { ArticleDocument } from '../types';

const docs = [
  { status: 'draft' },
  { status: 'approved' },
] as ArticleDocument[];

test('卷目筛选按审校状态过滤', () => {
  assert.equal(filterArticlesByStatus(docs, 'all').length, 2);
  assert.equal(filterArticlesByStatus(docs, 'approved').length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test features/articles/articleLabels.test.ts`

Expected: FAIL，`filterArticlesByStatus` 未导出。把断言加进 Task 1 的测试文件。

- [ ] **Step 3: Write minimal implementation**

在 `articleLabels.ts` 增加：

```ts
export function filterArticlesByStatus<T extends { status?: ArticleStatus }>(
  docs: T[],
  status: ArticleStatus | 'all',
): T[] {
  if (status === 'all') return docs;
  return docs.filter((doc) => doc.status === status);
}
```

`ArticleInspectorPanel.tsx` 渲染「大纲」标题、折叠按钮，以及 `headings` 列表。空大纲显示「正文里还没有标题」。每项按 `level` 设置 `paddingLeft: (level - 1) * 12`。点击标题调用可选的 `onHeadingClick?: (index: number) => void`。面板底部不重复造统计，统计留在底栏。

`WordArticleEditor` 在纸页右侧放该面板，宽 `280px`，`collapsed` 时宽 `36px`。大纲数据来自 `extractArticleMetrics(editor.getJSON())` 在 `selectionTick` 变化时重算；不要为了大纲再写一次 store。

`WordToolbar` 增加两个 `<select>`：

- 首行缩进：`0` 与 `2em`，调用 `editor.chain().focus().setTextIndent(value).run()`。
- 行距：`1.5`、`1.8`、`2.0`，调用 `setLineHeight`。

`ArticleMetaModal` 在创建模式显示一组 radio，数据源是 `ARTICLE_TEMPLATES`。默认 `blank`。提交值增加 `templateId` 和对应 `docType`。编辑模式不显示模板，避免覆盖已有正文。

`ArticlesPage` 创建提交时：

```ts
const template = values.templateId ? getArticleTemplate(values.templateId) : undefined;
const contentHtml = template ? template.buildContent(seedContext) : undefined;
addArticle(activeProjectId, parentId, {
  ...values,
  docType: template?.docType ?? 'custom',
  contentHtml,
});
```

`seedContext` 使用现有 `ensureArticleInitialized` 的同一组项目字段。

卷目卡片在标题旁显示 `DOC_TYPE_LABELS[doc.docType]` 和 `STATUS_LABELS[doc.status]`。卡片网格上方加 `<select>`，选项为全部、草稿、待校、定稿，过滤 `selectedArticleNode.children`。没有 `doc` 的子节点在筛选非 `all` 时隐藏。

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test features/articles && bun run lint`

Expected: 全部 PASS，`tsc --noEmit` 无错误。

- [ ] **Step 5: Commit**

```bash
git add features/articles/articleLabels.ts features/articles/articleLabels.test.ts features/articles/components/ArticleInspectorPanel.tsx features/articles/components/WordArticleEditor.tsx features/articles/components/WordToolbar.tsx features/articles/components/ArticleMetaModal.tsx features/articles/pages/ArticlesPage.tsx
git commit -m "feat: 谱文大纲、模板选择和卷目状态徽标"
```

---

## Spec coverage

- D1 HTML 单一数据源：Task 2、5、8。
- D2 每键写库：Task 9。
- D3 伪 `.doc`：Task 11。
- D4 假页码：Task 9。编辑期不计算页数。
- D5 人物和谱书关系：不在本计划。见 `2026-11-24-puwen-p1-lineage-revisions.md`。
- 首行缩进、行距、图注、赫蹏、模板、大纲、docx：Task 4、6、7、10、11、12。
- v1 → v2 字段补齐：Task 3、8。`contentJson` 懒生成在 Task 9 的切换篇章逻辑里，不在迁移函数里。
- Base64 禁止：Task 6、11。
- 后端 CAS、`@人物`、夹注、修订快照、谱书定稿校验：不在本计划。

## 自检

- 计划中的节点名 `figureImage`、`personMention`、`inlineAnnotation` 在 metrics、persist、docx 三处一致。
- `commitArticleContent` 是 store 和测试共用的签名；编辑器只传 `contentJson`。
- 没有把 P1 的 mention 扩展或 P2 的 API 提前写进 P0 依赖。
