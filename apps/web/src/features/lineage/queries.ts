import { useMemo } from 'react';
import {
  type QueryClient,
  useQueries,
  useQuery,
} from '@tanstack/react-query';
import { useLineageStore } from '../../store/useLineageStore';
import {
  directoryToTreeItems,
  graphToPersonRecords,
} from './adapter';
import {
  fetchLineageDirectory,
  fetchLineageGraph,
  type LineageDirectoryPayload,
  type LineageGraphPayload,
} from './api';
import type { PersonRecord } from './types';

export const lineageKeys = {
  all: ['lineage'] as const,
  directory: (projectId: string) =>
    ['lineage', 'directory', projectId] as const,
  graph: (projectId: string, lineageId: string) =>
    ['lineage', 'graph', projectId, lineageId] as const,
};

export function useLineageDirectoryQuery(projectId: string) {
  return useQuery<LineageDirectoryPayload>({
    queryKey: lineageKeys.directory(projectId),
    queryFn: () => fetchLineageDirectory(projectId),
    enabled: Boolean(projectId),
  });
}

export function useLineageGraphQuery(projectId: string, lineageId: string) {
  return useQuery<LineageGraphPayload>({
    queryKey: lineageKeys.graph(projectId, lineageId),
    queryFn: () => fetchLineageGraph(projectId, lineageId),
    enabled: Boolean(projectId && lineageId),
  });
}

export async function invalidateLineageDirectory(
  queryClient: QueryClient,
  projectId: string,
) {
  await queryClient.invalidateQueries({
    queryKey: lineageKeys.directory(projectId),
  });
}

export async function invalidateLineageGraph(
  queryClient: QueryClient,
  projectId: string,
  lineageId: string,
) {
  await queryClient.invalidateQueries({
    queryKey: lineageKeys.graph(projectId, lineageId),
  });
}

const EMPTY_COLLAPSED: Record<string, boolean> = {};

/**
 * Provides full project lineage tree + mapped PersonRecord map for cross-module
 * consumers (stats modal, article mentions, book workspace, catalog modals).
 */
export function useProjectLineageSnapshot(projectId: string) {
  const collapsedByProject = useLineageStore(
    (s) => s.collapsedFoldersByProject[projectId] ?? EMPTY_COLLAPSED,
  );
  const directoryQuery = useLineageDirectoryQuery(projectId);

  const lineages = useMemo(
    () => directoryQuery.data?.lineages ?? [],
    [directoryQuery.data],
  );

  const lineageTree = useMemo(
    () =>
      directoryToTreeItems(
        directoryQuery.data?.folders ?? [],
        lineages,
        collapsedByProject,
      ),
    [directoryQuery.data, lineages, collapsedByProject],
  );

  const graphQueries = useQueries({
    queries: lineages.map((lin) => ({
      queryKey: lineageKeys.graph(projectId, lin.id),
      queryFn: () => fetchLineageGraph(projectId, lin.id),
      enabled: Boolean(projectId && lin.id),
    })),
  });

  const graphSignature = graphQueries
    .map((q) => `${q.dataUpdatedAt}:${q.isPending ? 1 : 0}`)
    .join('|');
  const graphPayloads = graphQueries.map((q) => q.data);
  const graphsLoading = graphQueries.some((q) => q.isPending);

  const personsByChart = useMemo(() => {
    const map: Record<string, PersonRecord[]> = {};
    lineages.forEach((lin, index) => {
      const payload = graphPayloads[index];
      if (!payload) return;
      map[`${projectId}::${lin.id}`] = graphToPersonRecords(projectId, payload);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, lineages, graphSignature]);

  return {
    directory: directoryQuery.data,
    lineageTree,
    personsByChart,
    isLoading: directoryQuery.isPending || graphsLoading,
  };
}
