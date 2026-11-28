import '../features/articles/extensions/articleSchema.happy-dom.ts';
import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import type { TreeItem } from '../components/common/Tree/types.ts';
import {
  articleDirectoryToTreeItems,
  buildArticlesByKey,
} from '../features/articles/adapter.ts';
import { makeArticleStorageKey } from '../features/articles/articleData.ts';
import { createArticleSaveQueue } from '../features/articles/domain/articleSaveQueue.ts';
import type { ArticleDocument } from '../features/articles/types.ts';
import { createEmptySections } from '../features/books/bookDefaults.ts';
import { preserveCollapsedChildren } from '../lib/treeOps.ts';
import { useArticleStore } from './useArticleStore.ts';
import { useBookStore } from './useBookStore.ts';
import {
  resolveChartSurname,
  useLineageStore,
} from './useLineageStore.ts';

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

test('useLineageStore, useArticleStore, and useBookStore hold only pure UI state', () => {
  const projectId = 'test-ui-proj';
  useLineageStore.setState({
    selectedNodeIdByProject: {},
    selectedPersonIdByChart: {},
    viewModeByProject: {},
    collapsedFoldersByProject: {},
  });
  useArticleStore.setState({
    selectedNodeIdByProject: {},
    collapsedFoldersByProject: {},
    articleConflict: null,
    saveError: null,
  });
  useBookStore.setState({
    selectedBookIdByProject: {},
    activeStepByBook: {},
  });

  useLineageStore.getState().selectNode(projectId, 'chart-1');
  useLineageStore.getState().selectPerson(projectId, 'chart-1', 'person-1');
  useLineageStore.getState().setViewMode(projectId, 'grid');
  useLineageStore.getState().setFolderCollapsed(projectId, 'folder-1', true);

  const linState = useLineageStore.getState();
  assert.equal(linState.selectedNodeIdByProject[projectId], 'chart-1');
  assert.equal(linState.selectedPersonIdByChart[`${projectId}::chart-1`], 'person-1');
  assert.equal(linState.viewModeByProject[projectId], 'grid');
  assert.equal(linState.collapsedFoldersByProject[projectId]?.['folder-1'], true);
  assert.equal('treesByProject' in linState, false);
  assert.equal('personsByChart' in linState, false);

  useArticleStore.getState().selectNode(projectId, 'art-1');
  useArticleStore.getState().setFolderCollapsed(projectId, 'art-folder-1', true);
  useArticleStore.getState().setSaveError('conflict');
  const artState = useArticleStore.getState();
  assert.equal(artState.selectedNodeIdByProject[projectId], 'art-1');
  assert.equal(artState.collapsedFoldersByProject[projectId]?.['art-folder-1'], true);
  assert.equal(artState.saveError, 'conflict');
  assert.equal('treesByProject' in artState, false);
  assert.equal('articlesByKey' in artState, false);

  useBookStore.getState().selectBook(projectId, 'book-1');
  useBookStore.getState().setActiveStep('book-1', 'layout');
  const bookState = useBookStore.getState();
  assert.equal(bookState.selectedBookIdByProject[projectId], 'book-1');
  assert.equal(bookState.activeStepByBook['book-1'], 'layout');
  assert.equal('booksByProject' in bookState, false);
});

test('articleDirectoryToTreeItems and buildArticlesByKey isolate articles by projectId', () => {
  const sampleDoc = (id: string, title: string, folderId: string | null): ArticleDocument => ({
    id,
    projectId: 'proj-1',
    folderId,
    seq: 0,
    title,
    subtitle: '',
    author: '编委会',
    docType: 'preface',
    status: 'draft',
    privacy: 'clan',
    contentHtml: '<p>正文</p>',
    linkedPersonIds: [],
    linkedChartIds: [],
    citations: [],
    version: 1,
    wordCount: 2,
    updatedAt: '2026-11-27 12:00',
  });

  const tree = articleDirectoryToTreeItems(
    [
      {
        id: 'folder-1',
        projectId: 'proj-1',
        kind: 'article',
        name: '卷一',
        seq: 0,
        createdAt: '2026-11-27T00:00:00Z',
        updatedAt: '2026-11-27T00:00:00Z',
      },
    ],
    [sampleDoc('art-1', '宗谱序言', 'folder-1'), sampleDoc('art-2', '凡例', null)],
    { 'folder-1': true },
  );

  assert.equal(tree.length, 2);
  assert.equal(tree[0].type, 'folder');
  assert.equal(tree[0].collapsed, true);
  assert.equal(tree[0].children.length, 1);
  assert.equal(tree[1].id, 'art-2');

  const map1 = buildArticlesByKey('proj-1', [sampleDoc('shared-id', '甲谱', null)]);
  const map2 = buildArticlesByKey('proj-2', [sampleDoc('shared-id', '乙谱', null)]);
  assert.equal(map1[makeArticleStorageKey('proj-1', 'shared-id')].title, '甲谱');
  assert.equal(map2[makeArticleStorageKey('proj-2', 'shared-id')].title, '乙谱');

  const sections = createEmptySections();
  assert.deepEqual(Object.keys(sections), ['preface', 'body', 'lineage', 'appendix']);
});
