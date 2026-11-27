import assert from 'node:assert/strict';
import { test } from 'vitest';
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