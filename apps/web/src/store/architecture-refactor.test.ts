import '../features/articles/extensions/articleSchema.happy-dom.ts';
import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import type { TreeItem } from '../components/common/Tree/types.ts';
import { createArticleSaveQueue } from '../features/articles/domain/articleSaveQueue.ts';
import { makeArticleStorageKey } from '../features/articles/articleData.ts';
import { preserveCollapsedChildren } from '../lib/treeOps.ts';
import {
  resolveChartSurname,
  useLineageStore,
} from './useLineageStore.ts';
import { useArticleRevisionStore } from './useArticleRevisionStore.ts';
import { useArticleStore } from './useArticleStore.ts';
import { useBookEditionStore } from './useBookEditionStore.ts';
import { createEmptySections, useBookStore } from './useBookStore.ts';

test('preserveCollapsedChildren preserves nested collapsed subtrees in O(N)', () => {
  const prev: TreeItem[] = [
    {
      id: 'folder-a',
      type: 'folder',
      collapsed: true,
      data: { name: '卷一' },
      children: [
        { id: 'doc-1', type: 'article', data: { name: '谱序' }, children: [] },
        {
          id: 'folder-b',
          type: 'folder',
          collapsed: true,
          data: { name: '子卷' },
          children: [
            { id: 'doc-2', type: 'article', data: { name: '凡例' }, children: [] },
          ],
        },
      ],
    },
  ];

  // dnd-kit flatten/projection flattens collapsed folders to children: []
  const nextFromDrag: TreeItem[] = [
    {
      id: 'folder-a',
      type: 'folder',
      collapsed: true,
      data: { name: '卷一' },
      children: [],
    },
  ];

  const merged = preserveCollapsedChildren(prev, nextFromDrag);
  assert.equal(merged[0].children.length, 2);
  assert.equal(merged[0].children[1].children[0].id, 'doc-2');
});

test('articleSaveQueue captures source projectId across rapid edits and project switches', () => {
  const commits: Array<{ projectId?: string; articleId: string }> = [];
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
    projectHtml: () => '<p>正文</p>',
    onCommit: (commit) =>
      commits.push({ projectId: commit.projectId, articleId: commit.articleId }),
  });

  const doc: JSONContent = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: '正文' }] }],
  };

  queue.noteEdit('article-preface', () => doc, 'proj-alpha');
  // Simulate timer/flush firing after user has switched projects
  queue.flush();

  assert.deepEqual(commits, [
    { projectId: 'proj-alpha', articleId: 'article-preface' },
  ]);
  assert.equal(scheduled, null);
});

test('resolveChartSurname reads explicit chart surname before project fallback without prefix checks', () => {
  const royalNode: TreeItem = {
    id: 'lineage-royal-1',
    type: 'chart',
    data: { name: '西汉天潢图系', surname: '刘' },
    children: [],
  };
  const otherNode: TreeItem = {
    id: 'lineage-other-1',
    type: 'chart',
    data: { name: '小田幼房世派世系图', surname: '' },
    children: [],
  };

  assert.equal(resolveChartSurname(royalNode, '陈'), '刘');
  assert.equal(resolveChartSurname(otherNode, '陈'), '');
  assert.equal(
    resolveChartSurname(
      { id: 'custom-chart', type: 'chart', data: { name: '陈氏支系' }, children: [] },
      '陈',
    ),
    '陈',
  );
  assert.equal(resolveChartSurname(undefined, '林'), '林');
});

test('useLineageStore.ensureProjectInitialized respects hydration gate and importDemoLineage loads demo lazily', async () => {
  const projectId = 'test-lineage-gate-proj';
  useLineageStore.setState({
    _hasHydrated: false,
    treesByProject: {},
    selectedNodeIdByProject: {},
    personsByChart: {},
  });

  useLineageStore.getState().ensureProjectInitialized(projectId);
  assert.equal(useLineageStore.getState().treesByProject[projectId], undefined);

  useLineageStore.getState()._setHasHydrated(true);
  useLineageStore.getState().ensureProjectInitialized(projectId);
  assert.deepEqual(useLineageStore.getState().treesByProject[projectId], []);

  await useLineageStore.getState().importDemoLineage(projectId);
  assert.ok((useLineageStore.getState().treesByProject[projectId]?.length ?? 0) > 0);
  assert.ok(
    (useLineageStore.getState().personsByChart[`${projectId}::lineage-royal-1`]?.length ?? 0) > 0,
  );
});

test('useArticleStore unifies rename/meta updates and isolates revisions by projectId::articleId', () => {
  useArticleStore.setState({
    _hasHydrated: true,
    treesByProject: {},
    selectedNodeIdByProject: {},
    articlesByKey: {},
    articleConflict: null,
  });
  useArticleRevisionStore.setState({ revisionsByKey: {} });

  const ctx = { familyName: '测试族' };
  useArticleStore.getState().ensureProjectInitialized('proj-1', ctx);
  useArticleStore.getState().ensureProjectInitialized('proj-2', ctx);

  // Both projects share the same seed article ID ('article-preface')
  useArticleStore.getState().renameNode('proj-1', 'article-preface', '甲项目序');
  useArticleStore.getState().updateArticleMeta('proj-2', 'article-preface', {
    title: '乙项目序',
    status: 'approved',
  });

  const doc1 =
    useArticleStore.getState().articlesByKey[
      makeArticleStorageKey('proj-1', 'article-preface')
    ];
  const doc2 =
    useArticleStore.getState().articlesByKey[
      makeArticleStorageKey('proj-2', 'article-preface')
    ];

  assert.equal(doc1.title, '甲项目序');
  assert.equal(doc2.title, '乙项目序');
  assert.equal(doc2.status, 'approved');

  useArticleStore.getState().recordRevision('proj-1', 'article-preface', '甲修订', '甲');
  useArticleStore.getState().recordRevision('proj-2', 'article-preface', '乙修订', '乙');

  const revs1 = useArticleRevisionStore.getState().getRevisions('proj-1', 'article-preface');
  const revs2 = useArticleRevisionStore.getState().getRevisions('proj-2', 'article-preface');

  assert.equal(revs1.length, 1);
  assert.equal(revs1[0].summary, '甲修订');
  assert.equal(revs2.length, 1);
  assert.equal(revs2[0].summary, '乙修订');

  // Removing article from proj-1 clears proj-1 revisions without touching proj-2
  useArticleStore.getState().removeNode('proj-1', 'article-preface');
  assert.equal(
    useArticleRevisionStore.getState().getRevisions('proj-1', 'article-preface').length,
    0,
  );
  assert.equal(
    useArticleRevisionStore.getState().getRevisions('proj-2', 'article-preface').length,
    1,
  );
});

test('useBookStore keeps catalog mutations consistent and delegates editions to cold store', () => {
  useBookStore.setState({
    _hasHydrated: true,
    booksByProject: {},
    selectedBookIdByProject: {},
    activeStepByBook: {},
  });
  useBookEditionStore.setState({ editionsByBookId: {} });

  const projectId = 'proj-book-test';
  const bookId = useBookStore.getState().createBook(projectId, {
    bookName: '陈氏测试谱',
    headerName: '陈氏宗谱',
    hallName: '德星堂',
    volumeNo: '卷一',
    editor: '修谱委',
    compilationDate: '2026-01-01',
  });

  const chId = useBookStore.getState().addChapter(projectId, bookId, 'body', '旧章');
  useBookStore.getState().renameChapter(projectId, bookId, chId, '新章');
  useBookStore.getState().addArticleRefs(projectId, bookId, 'body', chId, [
    { sourceArticleId: 'art-1', sourceTitle: '源流考' },
  ]);

  let book = useBookStore
    .getState()
    .booksByProject[projectId]
    .find((b) => b.id === bookId)!;
  const chapterNode = book.sections.body.items[0];
  assert.equal(chapterNode.nodeType, 'chapter');
  assert.equal(chapterNode.title, '新章');

  // Deleting non-empty chapter must be blocked
  const blockedRes = useBookStore.getState().removeCatalogNode(projectId, bookId, chId);
  assert.equal(blockedRes.blocked, true);

  // Transfer article leaf out of chapter to appendix, then chapter can be deleted
  const artNodeId = chapterNode.children[0].id;
  useBookStore.getState().transferCatalogNode(projectId, bookId, artNodeId, 'appendix');
  useBookStore.getState().updateArticleRef(projectId, bookId, artNodeId, {
    displayTitle: '附录源流考',
    sourceArticleId: 'art-1',
    sourceTitle: '源流考',
  });

  const unblockedRes = useBookStore.getState().removeCatalogNode(projectId, bookId, chId);
  assert.equal(unblockedRes.blocked, false);

  book = useBookStore
    .getState()
    .booksByProject[projectId]
    .find((b) => b.id === bookId)!;
  assert.equal(book.sections.body.items.length, 0);
  assert.equal(book.sections.appendix.items.length, 1);
  assert.equal(book.sections.appendix.items[0].nodeType, 'article');
  if (book.sections.appendix.items[0].nodeType === 'article') {
    assert.equal(book.sections.appendix.items[0].displayTitle, '附录源流考');
  }

  // Edition compilation writes to yunpu:book-editions and keeps book.editions empty
  const edition = useBookStore.getState().generateEdition(projectId, bookId, {
    articlesByKey: {},
    lineageTree: [],
    personsByChart: {},
    projectSurname: '陈',
  });
  assert.ok(edition);
  assert.equal(useBookEditionStore.getState().editionsByBookId[bookId]?.length, 1);
  assert.equal(
    useBookStore.getState().booksByProject[projectId].find((b) => b.id === bookId)?.editions.length,
    0,
  );
  void createEmptySections;
});
