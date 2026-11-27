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
  subgraphToLineageGraphPayload,
} from './adapter';
import {
  fetchLineageDirectory,
  fetchLineageGraph,
  fetchLineagePersonsPage,
  fetchPersonDetail,
  fetchSubgraph,
  type LineageDirectoryPayload,
  type LineageDto,
  type LineageGraphPayload,
  type PersonDto,
  type SubgraphPayload,
} from './api';
import type { PersonRecord } from './types';

export const LINEAGE_WINDOW_THRESHOLD = 200;
export const DEFAULT_SUBGRAPH_UP_DEPTH = 2;
export const DEFAULT_SUBGRAPH_DOWN_DEPTH = 4;
export const DEFAULT_SUBGRAPH_LIMIT = 300;

export const lineageKeys = {
  all: ['lineage'] as const,
  directory: (projectId: string) =>
    ['lineage', 'directory', projectId] as const,
  graph: (projectId: string, lineageId: string) =>
    ['lineage', 'graph', projectId, lineageId] as const,
  personProbe: (projectId: string, lineageId: string, threshold: number) =>
    ['lineage', 'probe', projectId, lineageId, threshold] as const,
  subgraph: (
    projectId: string,
    lineageId: string,
    rootPersonId: string,
    upDepth: number,
    downDepth: number,
    limit: number,
  ) =>
    [
      'lineage',
      'subgraph',
      projectId,
      lineageId,
      rootPersonId,
      upDepth,
      downDepth,
      limit,
    ] as const,
  personDetail: (projectId: string, personId: string) =>
    ['lineage', 'person', projectId, personId] as const,
};

export function selectWindowAnchorPersonId(
  probePersons: PersonDto[],
  explicitAnchorId?: string | null,
  selectedPersonId?: string | null,
): string | null {
  if (explicitAnchorId) return explicitAnchorId;
  if (
    selectedPersonId &&
    probePersons.some((person) => person.id === selectedPersonId)
  ) {
    return selectedPersonId;
  }
  const progenitor = probePersons.find((person) =>
    person.relationTitle?.includes('始'),
  );
  return progenitor?.id ?? probePersons[0]?.id ?? null;
}

export interface WindowedCanvasLoadResult {
  mode: 'graph' | 'subgraph';
  graph: LineageGraphPayload;
  subgraphMeta: Omit<SubgraphPayload, 'persons' | 'relations'> | null;
}

/**
 * Probes lineage size against threshold and loads either full /graph
 * or windowed /subgraph centered on the resolved anchor person.
 */
export async function loadWindowedLineageCanvas(params: {
  projectId: string;
  lineage: LineageDto;
  threshold?: number;
  anchorPersonId?: string | null;
  selectedPersonId?: string | null;
  upDepth?: number;
  downDepth?: number;
  limit?: number;
}): Promise<WindowedCanvasLoadResult> {
  const threshold = Math.min(
    200,
    Math.max(1, params.threshold ?? LINEAGE_WINDOW_THRESHOLD),
  );
  const probe = await fetchLineagePersonsPage(params.projectId, {
    lineageId: params.lineage.id,
    limit: threshold,
  });

  if (!probe.nextCursor) {
    const graph = await fetchLineageGraph(params.projectId, params.lineage.id);
    if (graph.persons.length <= threshold || graph.persons.length === 0) {
      return { mode: 'graph', graph, subgraphMeta: null };
    }
  }

  const rootPersonId = selectWindowAnchorPersonId(
    probe.persons,
    params.anchorPersonId,
    params.selectedPersonId,
  );
  if (!rootPersonId) {
    const graph = await fetchLineageGraph(params.projectId, params.lineage.id);
    return { mode: 'graph', graph, subgraphMeta: null };
  }

  const subgraph = await fetchSubgraph(params.projectId, {
    rootPersonId,
    upDepth: params.upDepth ?? DEFAULT_SUBGRAPH_UP_DEPTH,
    downDepth: params.downDepth ?? DEFAULT_SUBGRAPH_DOWN_DEPTH,
    limit: params.limit ?? DEFAULT_SUBGRAPH_LIMIT,
  });

  return {
    mode: 'subgraph',
    graph: subgraphToLineageGraphPayload(params.lineage, subgraph),
    subgraphMeta: {
      rootPersonId: subgraph.rootPersonId,
      hasMoreAncestors: subgraph.hasMoreAncestors,
      hasMoreDescendants: subgraph.hasMoreDescendants,
    },
  };
}

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

export function usePersonDetailQuery(
  projectId: string,
  personId: string | null,
) {
  return useQuery<PersonDto>({
    queryKey: lineageKeys.personDetail(projectId, personId ?? ''),
    queryFn: async () => {
      const res = await fetchPersonDetail(projectId, personId!);
      return res.person;
    },
    enabled: Boolean(projectId && personId),
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
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: lineageKeys.graph(projectId, lineageId),
    }),
    queryClient.invalidateQueries({
      queryKey: ['lineage', 'probe', projectId, lineageId],
    }),
    queryClient.invalidateQueries({
      queryKey: ['lineage', 'subgraph', projectId, lineageId],
    }),
    queryClient.invalidateQueries({
      queryKey: ['lineage', 'person', projectId],
    }),
  ]);
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
