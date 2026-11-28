import { type ElkNode } from 'elkjs/lib/elk-api';
import { type GenealogyFlowEdge, type GenealogyFlowNode } from '../types';
import { FS_CARD_H, FS_CARD_W } from './layoutBuilder';

export interface ElkWorkerRequest {
  requestId: number;
  graph: ElkNode;
}

export type ElkWorkerResponse =
  | {
      requestId: number;
      layouted: ElkNode;
    }
  | {
      requestId: number;
      error: string;
    };

export interface ElkWorkerLike {
  postMessage(message: ElkWorkerRequest): void;
  onmessage: ((event: MessageEvent<ElkWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  terminate(): void;
}

export type ElkWorkerFactory = () => ElkWorkerLike;

export type ElkLayoutCancelReason = 'superseded' | 'aborted' | 'disposed';

export class ElkLayoutCancelledError extends Error {
  readonly code = 'ELK_LAYOUT_CANCELLED';
  readonly reason: ElkLayoutCancelReason;

  constructor(reason: ElkLayoutCancelReason) {
    super(`ELK layout cancelled (${reason})`);
    this.name = 'ElkLayoutCancelledError';
    this.reason = reason;
  }
}

export function isElkLayoutCancelledError(
  error: unknown
): error is ElkLayoutCancelledError {
  return error instanceof ElkLayoutCancelledError;
}

export interface ElkLayoutCallOptions {
  signal?: AbortSignal;
}

export interface ElkLayoutRunnerOptions {
  workerFactory?: ElkWorkerFactory;
}

export interface ElkLayoutRunner {
  layout: (
    nodes: GenealogyFlowNode[],
    edges: GenealogyFlowEdge[],
    options?: ElkLayoutCallOptions
  ) => Promise<GenealogyFlowNode[]>;
  cancel: () => void;
  dispose: () => void;
}

/**
 * Default browser Web Worker factory using Vite's module worker asset URL.
 * Environments without `Worker` (such as Node unit tests) must inject a
 * `workerFactory` via `createElkLayoutRunner` rather than silently falling
 * back to main-thread execution.
 */
export function createDefaultElkWorker(): ElkWorkerLike {
  if (typeof Worker === 'undefined') {
    throw new Error(
      'Web Worker is unavailable in this environment; provide workerFactory to createElkLayoutRunner'
    );
  }
  return new Worker(new URL('./elkLayout.worker.ts', import.meta.url), {
    type: 'module',
  });
}

export function buildElkGraph(
  nodes: GenealogyFlowNode[],
  edges: GenealogyFlowEdge[]
): ElkNode {
  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '28',
      'elk.layered.spacing.nodeNodeBetweenLayers': '68',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.edgeRouting': 'ORTHOGONAL',
    },
    children: nodes.map((node) => {
      const isCard = node.type === 'person';
      const isUnion = node.type === 'union';
      const width = isCard ? FS_CARD_W : isUnion ? 32 : 8;
      const height = isCard ? FS_CARD_H : isUnion ? 32 : 8;
      const generation =
        node.type === 'person'
          ? (node.data as { person?: { generation?: number } }).person?.generation
          : (node.data as { generation?: number })?.generation;

      return {
        id: node.id,
        width,
        height,
        layoutOptions: generation
          ? {
              'elk.layered.layering.layerId': String(generation),
            }
          : undefined,
      };
    }),
    edges: edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };
}

export function applyElkLayoutResult(
  nodes: GenealogyFlowNode[],
  layouted: ElkNode
): GenealogyFlowNode[] {
  const layoutNodeById = new Map<string, ElkNode>();
  for (const child of layouted.children ?? []) {
    layoutNodeById.set(child.id, child);
  }

  return nodes.map((node) => {
    const layoutNode = layoutNodeById.get(node.id);
    return {
      ...node,
      position: {
        x: layoutNode?.x ?? node.position.x,
        y: layoutNode?.y ?? node.position.y,
      },
    };
  });
}

interface PendingLayoutRequest {
  requestId: number;
  nodes: GenealogyFlowNode[];
  resolve: (nodes: GenealogyFlowNode[]) => void;
  reject: (error: unknown) => void;
  cleanupSignal: () => void;
}

/**
 * Creates a generation-fenced ELK layout runner backed by a Web Worker.
 * Rapid consecutive calls supersede previous in-flight requests and discard
 * stale worker replies.
 */
export function createElkLayoutRunner(
  options: ElkLayoutRunnerOptions = {}
): ElkLayoutRunner {
  const workerFactory = options.workerFactory ?? createDefaultElkWorker;
  let worker: ElkWorkerLike | null = null;
  let latestGeneration = 0;
  let pending: PendingLayoutRequest | null = null;

  const clearPending = (reason: ElkLayoutCancelReason): void => {
    if (!pending) return;
    const current = pending;
    pending = null;
    current.cleanupSignal();
    current.reject(new ElkLayoutCancelledError(reason));
  };

  const resetWorker = (): void => {
    if (!worker) return;
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
    worker = null;
  };

  const ensureWorker = (): ElkWorkerLike => {
    if (worker) return worker;

    const created = workerFactory();
    created.onmessage = (event) => {
      const response = event.data;
      if (
        !pending ||
        response.requestId !== pending.requestId ||
        response.requestId !== latestGeneration
      ) {
        return;
      }

      const current = pending;
      pending = null;
      current.cleanupSignal();

      if ('error' in response) {
        current.reject(new Error(response.error));
        return;
      }

      current.resolve(applyElkLayoutResult(current.nodes, response.layouted));
    };

    created.onerror = (event) => {
      const message =
        event.message ||
        (event.error instanceof Error ? event.error.message : '') ||
        'ELK layout worker error';
      resetWorker();
      if (!pending) return;
      const current = pending;
      pending = null;
      current.cleanupSignal();
      current.reject(new Error(message));
    };

    worker = created;
    return created;
  };

  const layout = (
    nodes: GenealogyFlowNode[],
    edges: GenealogyFlowEdge[],
    callOptions: ElkLayoutCallOptions = {}
  ): Promise<GenealogyFlowNode[]> => {
    if (callOptions.signal?.aborted) {
      return Promise.reject(new ElkLayoutCancelledError('aborted'));
    }

    clearPending('superseded');
    latestGeneration += 1;
    const requestId = latestGeneration;

    if (!nodes || nodes.length === 0) {
      return Promise.resolve([]);
    }

    let activeWorker: ElkWorkerLike;
    try {
      activeWorker = ensureWorker();
    } catch (error) {
      return Promise.reject(error);
    }

    return new Promise<GenealogyFlowNode[]>((resolve, reject) => {
      let cleanupSignal = () => {};
      const signal = callOptions.signal;

      if (signal) {
        const onAbort = () => {
          if (pending?.requestId === requestId) {
            pending = null;
            latestGeneration += 1;
            cleanupSignal();
            reject(new ElkLayoutCancelledError('aborted'));
          }
        };
        signal.addEventListener('abort', onAbort, { once: true });
        cleanupSignal = () => {
          signal.removeEventListener('abort', onAbort);
        };
      }

      pending = {
        requestId,
        nodes,
        resolve,
        reject,
        cleanupSignal,
      };

      try {
        const graph = buildElkGraph(nodes, edges);
        activeWorker.postMessage({ requestId, graph });
      } catch (error) {
        if (pending?.requestId === requestId) {
          pending = null;
        }
        cleanupSignal();
        resetWorker();
        reject(error);
      }
    });
  };

  const cancel = (): void => {
    latestGeneration += 1;
    clearPending('aborted');
  };

  const dispose = (): void => {
    latestGeneration += 1;
    clearPending('disposed');
    resetWorker();
  };

  return { layout, cancel, dispose };
}

let defaultRunner: ElkLayoutRunner | null = null;

function getDefaultRunner(): ElkLayoutRunner {
  if (!defaultRunner) {
    defaultRunner = createElkLayoutRunner();
  }
  return defaultRunner;
}

export function layoutWithElk(
  nodes: GenealogyFlowNode[],
  edges: GenealogyFlowEdge[],
  options?: ElkLayoutCallOptions
): Promise<GenealogyFlowNode[]> {
  return getDefaultRunner().layout(nodes, edges, options);
}
