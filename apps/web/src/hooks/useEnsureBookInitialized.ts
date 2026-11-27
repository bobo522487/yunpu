import { useEffect } from 'react';
import { useActiveProject } from './useActiveProject';
import { useProjectLineageSnapshot } from '../features/lineage/queries';
import { useArticleStore } from '../store/useArticleStore';
import { useBookStore } from '../store/useBookStore';

/**
 * Ensures article and book stores have completed hydration-gated project
 * initialization using live lineage snapshots without volatile store maps.
 */
export function useEnsureBookInitialized() {
  const { projectId, project, surname, articleSeedContext } = useActiveProject();

  const articleHydrated = useArticleStore((s) => s._hasHydrated);
  const bookHydrated = useBookStore((s) => s._hasHydrated);
  const {
    lineageTree,
    personsByChart,
    isLoading: lineageLoading,
  } = useProjectLineageSnapshot(projectId);

  const hasArticleTree = useArticleStore((s) =>
    Boolean(s.treesByProject[projectId]),
  );
  const hasBooks = useBookStore((s) => Boolean(s.booksByProject[projectId]));

  useEffect(() => {
    if (!projectId || !articleHydrated || !bookHydrated || lineageLoading) {
      return;
    }

    if (!hasArticleTree) {
      useArticleStore
        .getState()
        .ensureProjectInitialized(projectId, articleSeedContext);
      return;
    }

    if (!hasBooks) {
      const articleState = useArticleStore.getState();

      useBookStore.getState().ensureProjectInitialized(projectId, {
        familyName: project?.name,
        surname: surname || undefined,
        hallName: project?.hallName ?? undefined,
        editor: project?.hallName
          ? `${project.hallName}编委会`
          : '家族编委会',
        articleTree: articleState.treesByProject[projectId],
        lineageTree,
        personsByChart,
      });
    }
  }, [
    projectId,
    articleHydrated,
    bookHydrated,
    lineageLoading,
    hasArticleTree,
    hasBooks,
    project?.name,
    project?.hallName,
    surname,
    articleSeedContext,
    lineageTree,
    personsByChart,
  ]);
}
