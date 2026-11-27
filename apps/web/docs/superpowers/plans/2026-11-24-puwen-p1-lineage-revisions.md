# 谱文 P1：世系引用、夹注、修订与谱书定稿校验 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让谱文用结构化节点引用世系人物，记录段落级修订，并在谱书生成前提示未定稿或已删除的谱文。

**Architecture:** P0 的 `contentJson` 继续是唯一正文来源。`personMention` 和 `inlineAnnotation` 只是 schema 节点；显示名、缺人物降级、传略摘要、修订 diff 和谱书审计都是纯函数。修订写入同一份 `yunpu:articles` persist，版本升到 3。人物改名不回写正文，渲染时用 `personId` 读 `useLineageStore`。

**Tech Stack:** 沿用 P0 的 React 19、Tiptap 2.11.5、Zustand 5、`bun test`。新增 `@tiptap/extension-mention@2.11.5` 与 `@tiptap/suggestion@2.11.5`。

## Global Constraints

- 先完成 `docs/superpowers/plans/2026-11-24-puwen-p0-ssot-docx.md`。本计划假设 `contentJson`、`extractArticleMetrics`、`createArticleExtensions`、`commitArticleContent` 和 `articleJsonToDocxBlocks` 已经存在。
- 不换编辑器，不上 WebSocket、CRDT、Redis、Hocuspocus。
- `features/articles/domain/` 与新搬出的 `features/lineage/domain/personSummary.ts` 零 React、零 DOM。
- 节点名保持 `personMention`、`inlineAnnotation`。属性名保持 `personId`、`chartId`、`fallbackName`、`generation`、`mode`、`citationId`、`noteText`。
- 状态是显式字段 `draft | review | approved`，不做隐藏流转表。谱书只把 `status !== 'approved'` 和缺失文档当作警示，不阻止生成。
- 修订不是每次 800ms 自动保存都写一份。只有用户点击「记入修订」或修改审校状态时追加快照。每个文章最多保留 30 份，超出丢最旧的。
- 传略摘要只有一份实现。`bookCompiler.ts` 的私有 `buildPersonSummary` 搬到 `features/lineage/domain/personSummary.ts` 后，谱书和谱文一起引用。
- 人物被删除时显示 `fallbackName` 和「原世系节点已移除」，不渲染空字符串。
- persist `name` 仍是 `yunpu:articles`。已有 v2 数据升到 v3 时只补 `revisionsByArticleId: {}`。

## 文件结构

- `features/lineage/domain/personSummary.ts`：从 `bookCompiler.ts` 搬出的传略句子。
- `features/articles/domain/personMention.ts`：检索、显示名、传略 HTML。
- `features/articles/extensions/PersonMention.ts`：`@` 节点 schema。
- `features/articles/extensions/InlineAnnotation.ts`：脚注 / 双行夹注 schema。
- `features/articles/domain/slashCommands.ts`：斜杠命令表。
- `features/articles/domain/articleDiff.ts`：段落级 diff。
- `features/articles/domain/articleRevisions.ts`：追加、截断、回滚结果。
- `features/articles/components/ArticleRevisionModal.tsx`：diff 与回滚。
- `features/articles/components/PersonMentionList.tsx`：`@` 候选列表。
- `features/books/domain/bookArticleAudit.ts`：定稿审计和反查。
- 修改 `createArticleExtensions.ts`、`WordToolbar.tsx`、`WordArticleEditor.tsx`、`ArticleInspectorPanel.tsx`、`ArticleMetaModal.tsx`、`useArticleStore.ts`、`bookCompiler.ts`、`BookWorkspace.tsx`、`BookCatalogStep.tsx`、`BookEditionsStep.tsx`、`PersonDetailPanel.tsx`。

---

### Task 1: 传略摘要只保留一份

**Files:**
- Create: `features/lineage/domain/personSummary.ts`
- Modify: `features/books/bookCompiler.ts`
- Test: `features/lineage/domain/personSummary.test.ts`

**Interfaces:**
- Consumes: `PersonRecord`、`computeAutoRankLabel`、`formatPersonAliases`、`getPersonPrimaryTitle`、`getPersonDateDisplay`、`getPersonPlaceDisplay`。
- Produces: `buildPersonSummary(person: PersonRecord, allPersons: PersonRecord[], childrenNames: string[], spouses: PersonRecord[], rank: string): string`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PersonRecord } from '../types';
import { buildPersonSummary } from './personSummary.ts';

function person(partial: Partial<PersonRecord> & Pick<PersonRecord, 'id' | 'name'>): PersonRecord {
  return {
    branchId: 'chart-1',
    gender: 'male',
    status: 'deceased',
    generation: 1,
    fatherId: null,
    ...partial,
  };
}

test('传略摘要串起字号、生年和子女', () => {
  const summary = buildPersonSummary(
    person({ id: 'p1', name: '伯温', biography: '耕读传家' }),
    [],
    ['元亮'],
    [],
    '一世',
  );
  assert.match(summary, /一世/);
  assert.match(summary, /耕读传家/);
  assert.match(summary, /子：元亮/);
});

test('没有任何事实时给出待补行传', () => {
  const summary = buildPersonSummary(person({ id: 'p2', name: '某' }), [], [], [], '');
  assert.equal(summary, '世系谱名录存录，待补行传。');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test features/lineage/domain/personSummary.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: Write minimal implementation**

把 `features/books/bookCompiler.ts` 第 169–217 行的 `buildPersonSummary` 原样移到 `features/lineage/domain/personSummary.ts` 并导出。同步搬它所需的 import。`bookCompiler.ts` 改为：

```ts
import { buildPersonSummary } from '../lineage/domain/personSummary';
```

删除原私有函数。`appendLineagePages` 里的调用点不改参数。

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test features/lineage/domain/personSummary.test.ts && bun run lint`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add features/lineage/domain/personSummary.ts features/lineage/domain/personSummary.test.ts features/books/bookCompiler.ts
git commit -m "refactor: 传略摘要从谱书编译器挪到世系领域"
```

---

### Task 2: 人物提及的检索、降级和传略 HTML

**Files:**
- Create: `features/articles/domain/personMention.ts`
- Test: `features/articles/domain/personMention.test.ts`

**Interfaces:**
- Consumes: `buildPersonSummary`、`PersonRecord`。
- Produces:
  - `MentionCandidate = { personId: string; chartId: string; name: string; generation: number }`
  - `filterPersonMentions(query: string, people: MentionCandidate[]): MentionCandidate[]`，最多 8 条，按姓名包含匹配，空查询返回前 8 条。
  - `resolvePersonMentionLabel(attrs: { personId: string; fallbackName: string }, people: Array<{ id: string; name: string }>): { text: string; missing: boolean }`
  - `buildBiographyMentionHtml(person: PersonRecord, chartId: string, summary: string): string`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PersonRecord } from '../../lineage/types';
import {
  buildBiographyMentionHtml,
  filterPersonMentions,
  resolvePersonMentionLabel,
} from './personMention.ts';

const people = [
  { personId: 'p1', chartId: 'c1', name: '陈伯温', generation: 1 },
  { personId: 'p2', chartId: 'c1', name: '陈元亮', generation: 2 },
];

test('按姓名过滤并限制 8 条', () => {
  assert.equal(filterPersonMentions('伯温', people)[0]?.personId, 'p1');
  assert.equal(filterPersonMentions('', people).length, 2);
});

test('改名读最新姓名，删人退回 fallbackName', () => {
  assert.deepEqual(resolvePersonMentionLabel({ personId: 'p1', fallbackName: '伯温' }, [{ id: 'p1', name: '陈伯温' }]), {
    text: '陈伯温',
    missing: false,
  });
  assert.deepEqual(resolvePersonMentionLabel({ personId: 'gone', fallbackName: '伯温' }, []), {
    text: '伯温',
    missing: true,
  });
});

test('传略 HTML 带有 personMention 属性', () => {
  const person = {
    id: 'p1',
    branchId: 'c1',
    name: '伯温',
    gender: 'male',
    status: 'deceased',
    generation: 1,
    fatherId: null,
  } as PersonRecord;
  const html = buildBiographyMentionHtml(person, 'c1', '一世。耕读传家。');
  assert.match(html, /data-person-id="p1"/);
  assert.match(html, /data-chart-id="c1"/);
  assert.match(html, /data-fallback-name="伯温"/);
  assert.match(html, /data-generation="1"/);
  assert.match(html, /耕读传家/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test features/articles/domain/personMention.test.ts`

Expected: FAIL。

- [ ] **Step 3: Write minimal implementation**

```ts
import type { PersonRecord } from '../../lineage/types';

export interface MentionCandidate {
  personId: string;
  chartId: string;
  name: string;
  generation: number;
}

export function filterPersonMentions(query: string, people: MentionCandidate[]): MentionCandidate[] {
  const needle = query.trim().toLowerCase();
  const matched = needle
    ? people.filter((person) => person.name.toLowerCase().includes(needle))
    : people;
  return matched.slice(0, 8);
}

export function resolvePersonMentionLabel(
  attrs: { personId: string; fallbackName: string },
  people: Array<{ id: string; name: string }>,
): { text: string; missing: boolean } {
  const found = people.find((person) => person.id === attrs.personId);
  if (!found) return { text: attrs.fallbackName || '未命名', missing: true };
  return { text: found.name || attrs.fallbackName || '未命名', missing: false };
}

export function buildBiographyMentionHtml(person: PersonRecord, chartId: string, summary: string): string {
  const name = person.name || '未命名';
  return `<h2>生平概略</h2>
<p><span data-type="personMention" data-person-id="${person.id}" data-chart-id="${chartId}" data-fallback-name="${name}" data-generation="${person.generation}">${name}</span>，${summary}</p>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test features/articles/domain/personMention.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add features/articles/domain/personMention.ts features/articles/domain/personMention.test.ts
git commit -m "feat: 纯函数处理人物提及和传略初稿"
```

---

### Task 3: PersonMention 与 InlineAnnotation schema

**Files:**
- Create: `features/articles/extensions/PersonMention.ts`
- Create: `features/articles/extensions/InlineAnnotation.ts`
- Modify: `features/articles/extensions/createArticleExtensions.ts`
- Test: `features/articles/extensions/articleSchema.test.ts`
- Modify: `package.json`、`bun.lock`

**Interfaces:**
- Consumes: P0 的 `createArticleExtensions()`。
- Produces: 两个节点都加入 `createArticleExtensions()`。`personMention` 是 inline atom。`inlineAnnotation` 是 inline atom，`mode` 只允许 `interlinear | footnote`。

- [ ] **Step 1: Write the failing test**

在 `articleSchema.test.ts` 追加：

```ts
test('人物提及和夹注输出稳定属性', () => {
  const html = generateHTML(
    {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'personMention',
              attrs: { personId: 'p1', chartId: 'c1', fallbackName: '伯温', generation: 1 },
            },
            {
              type: 'inlineAnnotation',
              attrs: { mode: 'interlinear', citationId: 'cit-1', noteText: '待考' },
            },
          ],
        },
      ],
    },
    createArticleExtensions(),
  );
  assert.match(html, /data-person-id="p1"/);
  assert.match(html, /data-fallback-name="伯温"/);
  assert.match(html, /puwen-interlinear/);
  assert.match(html, /待考/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test features/articles/extensions/articleSchema.test.ts`

Expected: FAIL，未知节点被丢弃，HTML 不含 `data-person-id`。

- [ ] **Step 3: Write minimal implementation**

Run: `bun add @tiptap/extension-mention@2.11.5 @tiptap/suggestion@2.11.5`

`PersonMention.ts`：

```ts
import { mergeAttributes, Node } from '@tiptap/core';

export const PersonMention = Node.create({
  name: 'personMention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      personId: { default: '' },
      chartId: { default: '' },
      fallbackName: { default: '' },
      generation: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-person-id]' }, { tag: 'span[data-type="personMention"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'personMention',
        'data-person-id': node.attrs.personId,
        'data-chart-id': node.attrs.chartId,
        'data-fallback-name': node.attrs.fallbackName,
        'data-generation': node.attrs.generation ?? '',
        class: 'puwen-person-mention',
      }),
      String(node.attrs.fallbackName || '未命名'),
    ];
  },
});
```

`InlineAnnotation.ts`：

```ts
import { mergeAttributes, Node } from '@tiptap/core';

export const InlineAnnotation = Node.create({
  name: 'inlineAnnotation',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      mode: { default: 'footnote' },
      citationId: { default: null },
      noteText: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-annotation-mode]' }];
  },

  renderHTML({ node }) {
    const mode = node.attrs.mode === 'interlinear' ? 'interlinear' : 'footnote';
    const className = mode === 'interlinear' ? 'puwen-interlinear' : 'puwen-footnote';
    return [
      'span',
      mergeAttributes({
        'data-annotation-mode': mode,
        'data-citation-id': node.attrs.citationId ?? '',
        class: className,
      }),
      String(node.attrs.noteText || ''),
    ];
  },
});
```

把 `PersonMention` 和 `InlineAnnotation` 放进 `createArticleExtensions()`，位置在 `FigureImage` 之后。

渲染最新姓名不能写进 `renderHTML`，否则导出 HTML 会把当时姓名烤死。编辑器另加 `features/articles/components/PersonMentionView.tsx`，用 `ReactNodeViewRenderer` 只在浏览器包装这个节点。视图调用 `resolvePersonMentionLabel`。`missing` 为真时加 class `is-missing` 和 title `原世系节点已移除`。测试 schema 不启用 NodeView。`createArticleExtensions` 增加可选参数 `{ mentionView?: ComponentType }`，默认不传，测试保持纯 schema。

`puwen-prose.css` 追加：

```css
.article-word-prose .puwen-person-mention {
  padding: 0 0.2em;
  border-radius: 4px;
  background: hsl(var(--primary) / 0.12);
}

.article-word-prose .puwen-person-mention.is-missing {
  color: hsl(var(--muted-foreground));
  text-decoration: line-through;
}

.article-word-prose .puwen-footnote {
  font-size: 0.75em;
  vertical-align: super;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test features/articles/extensions/articleSchema.test.ts && bun run lint`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock features/articles/extensions features/articles/components/PersonMentionView.tsx features/articles/styles/puwen-prose.css
git commit -m "feat: 增加人物提及和双行夹注节点"
```

---

### Task 4: 斜杠命令表

**Files:**
- Create: `features/articles/domain/slashCommands.ts`
- Create: `features/articles/extensions/SlashCommand.ts`
- Create: `features/articles/components/SlashCommandMenu.tsx`
- Test: `features/articles/domain/slashCommands.test.ts`

**Interfaces:**
- Consumes: Tiptap `Editor` 的 `chain()`。
- Produces: `SlashCommandItem = { id: string; title: string; keywords: string[]; run: (editor: Editor) => void }` 与 `filterSlashCommands(query: string): SlashCommandItem[]`。命令 id 固定为 `heading`、`blockquote`、`table`、`divider`、`interlinear`、`footnote`。

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterSlashCommands } from './slashCommands.ts';

test('斜杠命令按标题和关键字过滤', () => {
  assert.equal(filterSlashCommands('夹注')[0]?.id, 'interlinear');
  assert.equal(filterSlashCommands('表格')[0]?.id, 'table');
  assert.ok(filterSlashCommands('').length >= 6);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test features/articles/domain/slashCommands.test.ts`

Expected: FAIL。

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Editor } from '@tiptap/core';

export interface SlashCommandItem {
  id: string;
  title: string;
  keywords: string[];
  run: (editor: Editor) => void;
}

export const SLASH_COMMANDS: SlashCommandItem[] = [
  { id: 'heading', title: '二级标题', keywords: ['标题', 'heading'], run: (editor) => { editor.chain().focus().setHeading({ level: 2 }).run(); } },
  { id: 'blockquote', title: '引言', keywords: ['引用', 'quote'], run: (editor) => { editor.chain().focus().toggleBlockquote().run(); } },
  { id: 'table', title: '表格', keywords: ['表'], run: (editor) => { editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); } },
  { id: 'divider', title: '分割线', keywords: ['hr'], run: (editor) => { editor.chain().focus().setHorizontalRule().run(); } },
  {
    id: 'interlinear',
    title: '双行夹注',
    keywords: ['夹注', '待考'],
    run: (editor) => {
      editor.chain().focus().insertContent({ type: 'inlineAnnotation', attrs: { mode: 'interlinear', noteText: '待考' } }).run();
    },
  },
  {
    id: 'footnote',
    title: '脚注',
    keywords: ['注'],
    run: (editor) => {
      editor.chain().focus().insertContent({ type: 'inlineAnnotation', attrs: { mode: 'footnote', noteText: '' } }).run();
    },
  },
];

export function filterSlashCommands(query: string): SlashCommandItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter((item) =>
    item.title.toLowerCase().includes(needle) || item.keywords.some((word) => word.toLowerCase().includes(needle)),
  );
}
```

创建 `features/articles/extensions/SlashCommand.ts`：

```ts
import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { filterSlashCommands, type SlashCommandItem } from '../domain/slashCommands';

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandItem>({
        editor: this.editor,
        char: '/',
        items: ({ query }) => filterSlashCommands(query),
        command: ({ editor, range, props }) => {
          editor.chain().focus().deleteRange(range).run();
          props.run(editor);
        },
      }),
    ];
  },
});
```

`SlashCommandMenu.tsx` 接收 `items: Array<{ id: string; title: string }>` 和 `onSelect(id: string)`，把每个 `title` 渲染成按钮。把 `SlashCommand` 放进 `createArticleExtensions()`。

`@` 候选不进斜杠表。在同一文件再导出 `PersonMentionSuggestion`，`char` 为 `@`。`items` 调用 `filterPersonMentions(query, this.options.people)`。选中后删除 `@query` 范围并插入：

```ts
editor.chain().focus().insertContent({
  type: 'personMention',
  attrs: {
    personId: item.personId,
    chartId: item.chartId,
    fallbackName: item.name,
    generation: item.generation,
  },
}).run();
```

`createArticleExtensions({ people })` 把 `people` 传给这个扩展。编辑器从 `useLineageStore` 当前项目的 `personsByChart` 扁平化出 `{ personId, chartId, name, generation }`，`chartId` 是 `makeChartStorageKey` 里 `::` 后面的那段。

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test features/articles/domain/slashCommands.test.ts && bun run lint`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add features/articles/domain/slashCommands.ts features/articles/domain/slashCommands.test.ts features/articles/extensions/SlashCommand.ts features/articles/components/SlashCommandMenu.tsx features/articles/extensions/createArticleExtensions.ts features/articles/components/WordArticleEditor.tsx
git commit -m "feat: 用斜杠命令和 @ 插入谱文结构"
```

---

### Task 5: 审校状态、隐私和检查器里的引用

**Files:**
- Modify: `features/articles/domain/articleCommit.ts`
- Modify: `features/articles/components/ArticleMetaModal.tsx`
- Modify: `features/articles/components/ArticleInspectorPanel.tsx`
- Modify: `store/useArticleStore.ts`
- Test: `features/articles/domain/articleCommit.test.ts`

**Interfaces:**
- Consumes: `ArticleStatus`、`ArticlePrivacy`、`ArticleCitation`。
- Produces: `commitArticleContent` 接受并保存 `status`、`privacy`、`citations`。缺省时保留 `existing` 的值。

- [ ] **Step 1: Write the failing test**

在 `articleCommit.test.ts` 追加：

```ts
test('提交时保留并更新审校状态', () => {
  const next = commitArticleContent(existing, 'a1', { status: 'review', privacy: 'editors' }, '2026-11-24 12:00');
  assert.equal(next.status, 'review');
  assert.equal(next.privacy, 'editors');
  assert.equal(next.version, 4);
});
```

`ArticleMetaInput` 增加可选 `status`、`privacy`、`citations`。

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test features/articles/domain/articleCommit.test.ts`

Expected: FAIL，返回值仍是 `draft`。

- [ ] **Step 3: Write minimal implementation**

`commitArticleContent` 里把这两行换成 updates 优先：

```ts
status: updates.status ?? existing?.status ?? 'draft',
privacy: updates.privacy ?? existing?.privacy ?? 'clan',
citations: updates.citations ?? existing?.citations ?? [],
```

`ArticleMetaModal` 编辑模式增加状态和隐私两个 `<select>`，选项文案用 `STATUS_LABELS` 和 `PRIVACY_LABELS`。创建模式默认草稿、族内，也显示这两个字段。

`ArticleInspectorPanel` 增加引用列表编辑：label、sourceType、detail。新增一条时 id 用 `citation-${Date.now()}`。保存通过 `onUpdateArticle({ citations })`，不改 `contentJson`。

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test features/articles/domain/articleCommit.test.ts && bun run lint`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add features/articles/types.ts features/articles/domain/articleCommit.ts features/articles/domain/articleCommit.test.ts features/articles/components/ArticleMetaModal.tsx features/articles/components/ArticleInspectorPanel.tsx store/useArticleStore.ts
git commit -m "feat: 谱文可标记审校状态、隐私和出处"
```

---

### Task 6: 段落 diff、修订快照和回滚

**Files:**
- Create: `features/articles/domain/articleDiff.ts`
- Create: `features/articles/domain/articleRevisions.ts`
- Modify: `features/articles/domain/migrateArticles.ts`
- Modify: `store/useArticleStore.ts`
- Create: `features/articles/components/ArticleRevisionModal.tsx`
- Test: `features/articles/domain/articleDiff.test.ts`
- Test: `features/articles/domain/articleRevisions.test.ts`

**Interfaces:**
- Consumes: `ArticleDocument`、`ArticleRevision`、`JSONContent`。
- Produces:
  - `diffArticleParagraphs(before: JSONContent, after: JSONContent): Array<{ kind: 'same' | 'added' | 'removed'; text: string }>`
  - `appendArticleRevision(existing: ArticleRevision[], revision: ArticleRevision, limit = 30): ArticleRevision[]`
  - `articleRevisionFromDocument(doc: ArticleDocument, summary: string, authorName: string, createdAt: string): ArticleRevision`
  - `restoreArticleFromRevision(current: ArticleDocument, revision: ArticleRevision, updatedAt: string): ArticleDocument`
  - store：`revisionsByArticleId: Record<string, ArticleRevision[]>`、`recordRevision(projectId, articleId, summary, authorName)`、`restoreRevision(projectId, articleId, revisionId, authorName)`
  - `migrateArticlesV2ToV3(persisted: unknown)`

- [ ] **Step 1: Write the failing test**

`articleDiff.test.ts`：

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { diffArticleParagraphs } from './articleDiff.ts';

test('段落 diff 标出新增和删除', () => {
  const diff = diffArticleParagraphs(
    { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '甲' }] }] },
    { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '乙' }] }] },
  );
  assert.deepEqual(diff.map((item) => item.kind), ['removed', 'added']);
  assert.equal(diff[0]?.text, '甲');
  assert.equal(diff[1]?.text, '乙');
});
```

`articleRevisions.test.ts`：

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ArticleDocument, ArticleRevision } from '../types';
import { appendArticleRevision, restoreArticleFromRevision } from './articleRevisions.ts';

test('超过 30 份时丢掉最旧修订', () => {
  const existing: ArticleRevision[] = Array.from({ length: 30 }, (_, index) => ({
    id: `r${index}`,
    articleId: 'a1',
    version: index + 1,
    title: '题',
    status: 'draft',
    contentJson: { type: 'doc' },
    contentHtml: '<p></p>',
    wordCount: 0,
    authorName: '甲',
    createdAt: String(index),
  }));
  const next = appendArticleRevision(existing, { ...existing[0], id: 'new', version: 31, createdAt: '31' });
  assert.equal(next.length, 30);
  assert.equal(next[0]?.id, 'r1');
  assert.equal(next[29]?.id, 'new');
});

test('回滚复制修订正文并递增当前版本', () => {
  const current = {
    id: 'a1',
    title: '新题',
    docType: 'custom',
    status: 'approved',
    privacy: 'clan',
    contentHtml: '<p>新</p>',
    contentJson: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '新' }] }] },
    linkedPersonIds: [],
    linkedChartIds: [],
    citations: [],
    version: 8,
    wordCount: 1,
    updatedAt: 'now',
  } as ArticleDocument;
  const revision = {
    id: 'r1',
    articleId: 'a1',
    version: 3,
    title: '旧题',
    status: 'draft',
    contentJson: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '旧' }] }] },
    contentHtml: '<p>旧</p>',
    wordCount: 1,
    authorName: '甲',
    createdAt: 'then',
  } as ArticleRevision;
  const restored = restoreArticleFromRevision(current, revision, 'later');
  assert.equal(restored.title, '旧题');
  assert.equal(restored.status, 'draft');
  assert.equal(restored.version, 9);
  assert.equal(restored.contentJson, revision.contentJson);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test features/articles/domain/articleDiff.test.ts features/articles/domain/articleRevisions.test.ts`

Expected: FAIL。

- [ ] **Step 3: Write minimal implementation**

创建 `features/articles/domain/articleDiff.ts`：

```ts
import type { JSONContent } from '@tiptap/core';

export interface ArticleBlockDiff {
  kind: 'same' | 'added' | 'removed';
  text: string;
}

function textOf(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'personMention') return String(node.attrs?.fallbackName ?? '');
  return (node.content ?? []).map((child) => textOf(child)).join('');
}

function blockTexts(json: JSONContent): string[] {
  const texts: string[] = [];
  const visit = (node: JSONContent) => {
    if (node.type === 'paragraph' || node.type === 'heading') {
      texts.push(textOf(node));
      return;
    }
    for (const child of node.content ?? []) visit(child);
  };
  for (const child of json.content ?? []) visit(child);
  return texts;
}

export function diffArticleParagraphs(before: JSONContent, after: JSONContent): ArticleBlockDiff[] {
  const left = blockTexts(before);
  const right = blockTexts(after);
  const dp: number[][] = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      dp[i][j] = left[i] === right[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const diff: ArticleBlockDiff[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      diff.push({ kind: 'same', text: left[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      diff.push({ kind: 'removed', text: left[i] });
      i += 1;
    } else {
      diff.push({ kind: 'added', text: right[j] });
      j += 1;
    }
  }
  while (i < left.length) {
    diff.push({ kind: 'removed', text: left[i] });
    i += 1;
  }
  while (j < right.length) {
    diff.push({ kind: 'added', text: right[j] });
    j += 1;
  }
  return diff;
}
```

`articleRevisions.ts`：

```ts
import type { JSONContent } from '@tiptap/core';
import type { ArticleDocument, ArticleRevision } from '../types';
import { extractArticleMetrics } from './articleMetrics';

export function articleRevisionFromDocument(
  doc: ArticleDocument,
  summary: string,
  authorName: string,
  createdAt: string,
): ArticleRevision {
  return {
    id: `rev-${doc.id}-${doc.version}`,
    articleId: doc.id,
    version: doc.version,
    title: doc.title,
    status: doc.status,
    contentJson: doc.contentJson ?? { type: 'doc', content: [] },
    contentHtml: doc.contentHtml,
    wordCount: doc.wordCount,
    summary,
    authorName,
    createdAt,
  };
}

export function appendArticleRevision(
  existing: ArticleRevision[],
  revision: ArticleRevision,
  limit = 30,
): ArticleRevision[] {
  const next = [...existing, revision];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

export function restoreArticleFromRevision(
  current: ArticleDocument,
  revision: ArticleRevision,
  updatedAt: string,
): ArticleDocument {
  const metrics = extractArticleMetrics(revision.contentJson as JSONContent);
  return {
    ...current,
    title: revision.title,
    status: revision.status,
    contentJson: revision.contentJson,
    contentHtml: revision.contentHtml,
    wordCount: revision.wordCount,
    linkedPersonIds: metrics.linkedPersonIds,
    linkedChartIds: metrics.linkedChartIds,
    version: current.version + 1,
    updatedAt,
  };
}
```

`migrateArticlesV2ToV3` 保留 v2 已有字段，并设置 `revisionsByArticleId` 为传入值或 `{}`。store 的 `version` 改为 `3`。`migrate` 先在 `version < 2` 时调用 `migrateArticlesV1ToV2`，再在结果版本小于 3 时调用 `migrateArticlesV2ToV3`。

`recordRevision` 读取当前文档，`authorName` 由调用方传入。空 `contentJson` 时先不记修订。`restoreRevision` 找到对应快照后调用 `restoreArticleFromRevision`，再追加一条 summary 为 `回滚至版本 ${revision.version}` 的新修订。

`ArticleRevisionModal` 列出修订时间、作者、summary。选中一项后用 `diffArticleParagraphs(revision.contentJson, current.contentJson)` 渲染删除为红色、新增为绿色。按钮「回滚到此版本」调用 `restoreRevision`。

检查器增加「记入修订」按钮，summary 来自一个单行输入。作者取 `useAuthStore.getState().user?.name || '家族编委会'`。状态 select 的变更同时调用 `updateArticleContent({ status })` 和 `recordRevision(..., '状态改为' + STATUS_LABELS[status])`。

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test features/articles/domain/articleDiff.test.ts features/articles/domain/articleRevisions.test.ts && bun run lint`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add features/articles/domain/articleDiff.ts features/articles/domain/articleDiff.test.ts features/articles/domain/articleRevisions.ts features/articles/domain/articleRevisions.test.ts features/articles/domain/migrateArticles.ts store/useArticleStore.ts features/articles/components/ArticleRevisionModal.tsx features/articles/components/ArticleInspectorPanel.tsx
git commit -m "feat: 记录谱文修订并支持段落对比回滚"
```

---

### Task 7: 谱书定稿审计与人物反查

**Files:**
- Create: `features/books/domain/bookArticleAudit.ts`
- Modify: `features/books/components/BookWorkspace.tsx`
- Modify: `features/books/components/BookCatalogStep.tsx`
- Modify: `features/books/components/BookEditionsStep.tsx`
- Modify: `features/articles/components/ArticleInspectorPanel.tsx`
- Modify: `features/lineage/components/PersonDetailPanel.tsx`
- Test: `features/books/domain/bookArticleAudit.test.ts`

**Interfaces:**
- Consumes: `BookRecord`、`ArticleDocument`、`makeArticleStorageKey`。
- Produces:
  - `BookArticleAuditIssue = { sourceArticleId: string; displayTitle: string; reason: 'missing' | 'draft' | 'review' }`
  - `auditBookArticles(projectId: string, book: BookRecord, articlesByKey: Record<string, ArticleDocument>): BookArticleAuditIssue[]`
  - `ArticleBookReference = { bookId: string; bookName: string; volumeNo: string }`
  - `findBooksReferencingArticle(articleId: string, books: BookRecord[]): ArticleBookReference[]`
  - `findArticlesReferencingPerson(personId: string, articlesByKey: Record<string, ArticleDocument>): Array<{ id: string; title: string; status: ArticleStatus }>`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ArticleDocument } from '../../articles/types';
import type { BookRecord } from '../types';
import {
  auditBookArticles,
  findArticlesReferencingPerson,
  findBooksReferencingArticle,
} from './bookArticleAudit.ts';

function article(partial: Partial<ArticleDocument> & Pick<ArticleDocument, 'id' | 'status'>): ArticleDocument {
  return {
    title: partial.id,
    docType: 'custom',
    privacy: 'clan',
    contentHtml: '<p></p>',
    linkedPersonIds: [],
    linkedChartIds: [],
    citations: [],
    version: 1,
    wordCount: 0,
    updatedAt: '',
    ...partial,
  };
}

test('未定稿和缺失谱文都会进入审计', () => {
  const book = {
    id: 'b1',
    bookName: '陈氏族谱',
    volumeNo: '卷一',
    sections: {
      preface: { items: [{ id: 'n1', nodeType: 'article', sourceArticleId: 'a1', sourceTitle: '序', displayTitle: '序' }] },
      body: { items: [{ id: 'n2', nodeType: 'chapter', title: '卷一', children: [{ id: 'n3', nodeType: 'article', sourceArticleId: 'missing', sourceTitle: '传', displayTitle: '传' }] }] },
      lineage: { items: [] },
      appendix: { items: [] },
    },
  } as unknown as BookRecord;
  const issues = auditBookArticles('p1', book, {
    'p1::a1': article({ id: 'a1', status: 'review', title: '序' }),
  });
  assert.deepEqual(issues.map((issue) => issue.reason).sort(), ['missing', 'review']);
});

test('反查谱书和人物', () => {
  const book = {
    id: 'b1',
    bookName: '陈氏族谱',
    volumeNo: '卷一',
    sections: {
      preface: { items: [] },
      body: { items: [{ id: 'n1', nodeType: 'article', sourceArticleId: 'a1', sourceTitle: '传', displayTitle: '传' }] },
      lineage: { items: [] },
      appendix: { items: [] },
    },
  } as unknown as BookRecord;
  assert.equal(findBooksReferencingArticle('a1', [book])[0]?.bookName, '陈氏族谱');
  const found = findArticlesReferencingPerson('person-1', {
    'p1::a1': article({ id: 'a1', status: 'approved', title: '伯温公传', linkedPersonIds: ['person-1'] }),
  });
  assert.equal(found[0]?.title, '伯温公传');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test features/books/domain/bookArticleAudit.test.ts`

Expected: FAIL。

- [ ] **Step 3: Write minimal implementation**

创建 `features/books/domain/bookArticleAudit.ts`：

```ts
import { makeArticleStorageKey } from '../../articles/articleData';
import type { ArticleDocument, ArticleStatus } from '../../articles/types';
import type { BookRecord, CatalogNode } from '../types';

export interface BookArticleAuditIssue {
  sourceArticleId: string;
  displayTitle: string;
  reason: 'missing' | 'draft' | 'review';
}

export interface ArticleBookReference {
  bookId: string;
  bookName: string;
  volumeNo: string;
}

function walkArticleNodes(nodes: CatalogNode[], visit: (node: { sourceArticleId: string; displayTitle: string }) => void) {
  for (const node of nodes) {
    if (node.nodeType === 'chapter') walkArticleNodes(node.children, visit);
    if (node.nodeType === 'article') visit(node);
  }
}

export function auditBookArticles(
  projectId: string,
  book: BookRecord,
  articlesByKey: Record<string, ArticleDocument>,
): BookArticleAuditIssue[] {
  const issues: BookArticleAuditIssue[] = [];
  for (const section of Object.values(book.sections)) {
    walkArticleNodes(section.items, (node) => {
      const doc = articlesByKey[makeArticleStorageKey(projectId, node.sourceArticleId)];
      if (!doc) {
        issues.push({ sourceArticleId: node.sourceArticleId, displayTitle: node.displayTitle, reason: 'missing' });
        return;
      }
      if (doc.status === 'draft' || doc.status === 'review') {
        issues.push({ sourceArticleId: node.sourceArticleId, displayTitle: node.displayTitle, reason: doc.status });
      }
    });
  }
  return issues;
}

export function findBooksReferencingArticle(articleId: string, books: BookRecord[]): ArticleBookReference[] {
  return books.filter((book) => {
    let found = false;
    for (const section of Object.values(book.sections)) {
      walkArticleNodes(section.items, (node) => {
        if (node.sourceArticleId === articleId) found = true;
      });
    }
    return found;
  }).map((book) => ({ bookId: book.id, bookName: book.bookName, volumeNo: book.volumeNo }));
}

export function findArticlesReferencingPerson(
  personId: string,
  articlesByKey: Record<string, ArticleDocument>,
): Array<{ id: string; title: string; status: ArticleStatus }> {
  return Object.values(articlesByKey)
    .filter((doc) => doc.linkedPersonIds.includes(personId))
    .map((doc) => ({ id: doc.id, title: doc.title, status: doc.status }));
}
```

`BookCatalogStep` 顶部若 `issues.length > 0`，显示黄底条文案：`有 ${issues.length} 篇谱文尚未定稿或已删除`，并列出 `displayTitle`。`BookEditionsStep` 在「生成新谱例」按钮旁显示同样的短句。`BookWorkspace.handleGenerateEdition` 不因 issue 返回，生成行为保持原样。

`ArticleInspectorPanel` 调用 `findBooksReferencingArticle(article.id, books)`。每条按钮文案为 `已被收录至：《${bookName} · ${volumeNo}》`。点击先 `useBookStore.getState().selectBook(projectId, bookId)`，再 `navigate({ to: '/projects/$projectId/books', params: { projectId } })`。

`PersonDetailPanel` 在传记区域下方增加「关联谱文」。数据来自 `findArticlesReferencingPerson`。按钮「生成传略初稿」调用 `buildPersonSummary` 和 `buildBiographyMentionHtml`，再 `useArticleStore.getState().addArticle(projectId, undefined, { title: `${person.name}公传略`, docType: 'biography', templateId: 'biography', contentHtml })`。生成后 `navigate` 到 `/projects/$projectId/articles`。

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test features/books/domain/bookArticleAudit.test.ts features/articles features/lineage/domain/personSummary.test.ts && bun run lint`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add features/books/domain/bookArticleAudit.ts features/books/domain/bookArticleAudit.test.ts features/books/components/BookWorkspace.tsx features/books/components/BookCatalogStep.tsx features/books/components/BookEditionsStep.tsx features/articles/components/ArticleInspectorPanel.tsx features/lineage/components/PersonDetailPanel.tsx
git commit -m "feat: 谱书生成前提示未定稿谱文并反查人物"
```

---

## Spec coverage

- `@` 检索、改名同步、删人降级：Task 2、3、4。
- 人物抽屉反查和一键传略：Task 1、7。
- 脚注 / 双行夹注和斜杠命令：Task 3、4。
- 草稿 / 待校 / 定稿：Task 5。谱书识别未定稿：Task 7。
- 修订 diff 和回滚：Task 6。
- v1 数据经过 P0 的 v2 后再到 v3：Task 6。
- 后端 CAS、CSS Paged Media、Hocuspocus、OCR：不在本计划。
