import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  mergePersonDetailIntoGraph,
  subgraphToLineageGraphPayload,
} from '../adapter';
import {
  fetchLineageGraph,
  fetchLineagePersonsPage,
  fetchSubgraph,
  type LineageDto,
  type LineageGraphPayload,
  type PersonPagePayload,
  type SubgraphPayload,
} from '../api';
import {
  DEFAULT_SUBGRAPH_DOWN_DEPTH,
  DEFAULT_SUBGRAPH_LIMIT,
  DEFAULT_SUBGRAPH_UP_DEPTH,
  LINEAGE_WINDOW_THRESHOLD,
  lineageKeys,
  selectWindowAnchorPersonId,
  usePersonDetailQuery,
} from '../queries';

interface UseLineageCanvasDataParams {
  projectId: string;
  lineage: LineageDto | null;
  selectedPersonId: string | null;
  anchorPersonId?: string | null;
  upDepth?: number;
  downDepth?: number;
  limit?: number;
  threshold?: number;
}

export interface UseLineageCanvasDataResult {
  mode: 'graph' | 'subgraph';
  graphData: LineageGraphPayload | undefined;
  subgraphMeta: Omit<SubgraphPayload, 'persons' | 'relations'> | null;
  isPending: boolean;
  isDetailFetching: boolean;
}

/**
 * Loads the active lineage canvas using a size probe:
 * - <= threshold: loads slim /graph (without full events)
 * - > threshold: switches to windowed /subgraph centered on the anchor person
 * When a person is selected, fetches full names & events via GET /persons/:personId.
 */
export function useLineageCanvasData({
  projectId,
  lineage,
  selectedPersonId,
  anchorPersonId = null,
  upDepth = DEFAULT_SUBGRAPH_UP_DEPTH,
  downDepth = DEFAULT_SUBGRAPH_DOWN_DEPTH,
  limit = DEFAULT_SUBGRAPH_LIMIT,
  threshold = LINEAGE_WINDOW_THRESHOLD,
}: UseLineageCanvasDataParams): UseLineageCanvasDataResult {
  const lineageId = lineage?.id ?? '';
  const safeThreshold = Math.min(200, Math.max(1, threshold));
  const enabled = Boolean(projectId && lineageId);

  const probeQuery = useQuery<PersonPagePayload>({
    queryKey: lineageKeys.personProbe(projectId, lineageId, safeThreshold),
    queryFn: () =>
      fetchLineagePersonsPage(projectId, {
        lineageId,
        limit: safeThreshold,
      }),
    enabled,
  });

  const exceedsThreshold = Boolean(probeQuery.data?.nextCursor);
  const resolvedAnchorId = useMemo(
    () =>
      probeQuery.data
        ? selectWindowAnchorPersonId(
            probeQuery.data.persons,
            anchorPersonId,
            selectedPersonId,
          )
        : null,
    [probeQuery.data, anchorPersonId, selectedPersonId],
  );

  const shouldUseSubgraph = Boolean(
    enabled && probeQuery.isSuccess && exceedsThreshold && resolvedAnchorId,
  );
  const shouldUseGraph = Boolean(
    enabled && probeQuery.isSuccess && (!exceedsThreshold || !resolvedAnchorId),
  );

  const graphQuery = useQuery<LineageGraphPayload>({
    queryKey: lineageKeys.graph(projectId, lineageId),
    queryFn: () => fetchLineageGraph(projectId, lineageId),
    enabled: shouldUseGraph,
  });

  const subgraphQuery = useQuery<SubgraphPayload>({
    queryKey: lineageKeys.subgraph(
      projectId,
      lineageId,
      resolvedAnchorId ?? '',
      upDepth,
      downDepth,
      limit,
    ),
    queryFn: () =>
      fetchSubgraph(projectId, {
        rootPersonId: resolvedAnchorId!,
        upDepth,
        downDepth,
        limit,
      }),
    enabled: shouldUseSubgraph,
  });

  const personDetailQuery = usePersonDetailQuery(projectId, selectedPersonId);

  const baseGraphData = useMemo(() => {
    if (shouldUseSubgraph && subgraphQuery.data && lineage) {
      return subgraphToLineageGraphPayload(lineage, subgraphQuery.data);
    }
    return graphQuery.data;
  }, [shouldUseSubgraph, subgraphQuery.data, lineage, graphQuery.data]);

  const graphData = useMemo(
    () =>
      baseGraphData
        ? mergePersonDetailIntoGraph(baseGraphData, personDetailQuery.data)
        : undefined,
    [baseGraphData, personDetailQuery.data],
  );

  const subgraphMeta = useMemo(() => {
    if (!shouldUseSubgraph || !subgraphQuery.data) return null;
    return {
      rootPersonId: subgraphQuery.data.rootPersonId,
      hasMoreAncestors: subgraphQuery.data.hasMoreAncestors,
      hasMoreDescendants: subgraphQuery.data.hasMoreDescendants,
    };
  }, [shouldUseSubgraph, subgraphQuery.data]);

  const isPending =
    enabled &&
    (probeQuery.isPending ||
      (shouldUseSubgraph ? subgraphQuery.isPending : graphQuery.isPending));

  return {
    mode: shouldUseSubgraph ? 'subgraph' : 'graph',
    graphData,
    subgraphMeta,
    isPending,
    isDetailFetching: personDetailQuery.isFetching,
  };
}
