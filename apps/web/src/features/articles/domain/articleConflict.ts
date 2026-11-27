import type { ArticleDocument } from '../types';

export function resolveArticleConflict(
  choice: 'keep-local' | 'take-server',
  local: ArticleDocument,
  server: ArticleDocument,
): ArticleDocument {
  if (choice === 'take-server') return server;
  return { ...local, version: server.version };
}