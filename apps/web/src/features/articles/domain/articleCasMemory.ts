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