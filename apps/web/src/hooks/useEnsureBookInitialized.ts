import { useEffect } from 'react';
import { useActiveProject } from './useActiveProject';
import { useArticleStore } from '../store/useArticleStore';
import { useBookStore } from '../store/useBookStore';
import { useLineageStore } from '../store/useLineageStore';

/**
 * Ensures article, lineage, and book stores have completed hydration-gated
 * project initialization without subscribing to volatile entity maps.
 */
export function useEnsureBookInitialized() {
  const { projectId, project, surname, articleSeedContext } = useActiveProject();

  const articleHydrated = useArticleStore((s) => s._hasHydrated);
  const lineageHydrated = useLineageStore((s) => s._hasHydrated);
  const bookHydrated = useBookStore((s) => s._hasHydrated);

  const hasArticleTree = useArticleStore((s) => Boolean(s.treesByProject[projectId]));
  const hasLineageTree = useLineageStore((s) => Boolean(s.treesByProject[projectId]));
  const hasBooks = useBookStore((s) => Boolean(s.booksByProject[projectId]));

  useEffect(() => {
    if (!projectId || !articleHydrated || !lineageHydrated || !bookHydrated) {
      return;
    }

    if (!hasLineageTree) {
      useLineageStore.getState().ensureProjectInitialized(projectId);
    }

    if (!hasArticleTree) {
      useArticleStore
        .getState()
        .ensureProjectInitialized(projectId, articleSeedContext);
      return;
    }

    if (!hasBooks) {
      const articleState = useArticleStore.getState();
      const lineageState = useLineageStore.getState();
      const lineageTree = lineageState.treesByProject[projectId] ?? [];

      useBookStore.getState().ensureProjectInitialized(projectId, {
        familyName: project?.name,
        surname: surname || undefined,
        hallName: project?.hallName ?? undefined,
        editor: project?.hallName ? `${project.hallName}编委会` : '家族编委会',
        articleTree: articleState.treesByProject[projectId],
        lineageTree,
        personsByChart: lineageState.personsByChart,
      });
    }
  }, [
    projectId,
    articleHydrated,
    lineageHydrated,
    bookHydrated,
    hasArticleTree,
    hasLineageTree,
    hasBooks,
    project?.name,
    project?.hallName,
    surname,
    articleSeedContext,
  ]);
}
