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