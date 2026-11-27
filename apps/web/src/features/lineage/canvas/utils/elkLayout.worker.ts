import ELK, {
  type ELK as ELKInstance,
  type ElkNode,
} from 'elkjs/lib/elk.bundled.js';
import type { ElkWorkerRequest, ElkWorkerResponse } from './elkLayout';

export interface ElkWorkerScope {
  onmessage: ((event: { data: ElkWorkerRequest }) => void) | null;
  postMessage: (message: ElkWorkerResponse) => void;
}

/**
 * Creates an ELK layout executor backed by a dedicated ELK instance.
 * Instantiates `ELK` eagerly so `elk-worker.min.js` runs its global
 * `self.onmessage` side effect before `attachElkWorker` binds the worker handler.
 */
export function createElkLayoutExecutor(): (graph: ElkNode) => Promise<ElkNode> {
  const elk: ELKInstance = new ELK();

  return async (graph: ElkNode): Promise<ElkNode> => elk.layout(graph);
}

/**
 * Binds worker message handling onto a Web Worker global scope.
 * Must run after `createElkLayoutExecutor()` because `elk-worker.min.js`
 * assigns `self.onmessage` when `new ELK()` first loads it.
 */
export function attachElkWorker(scope: ElkWorkerScope): void {
  const executeLayout = createElkLayoutExecutor();

  scope.onmessage = (event) => {
    const { requestId, graph } = event.data;
    void executeLayout(graph)
      .then((layouted) => {
        scope.postMessage({ requestId, layouted });
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'ELK layout worker failed';
        scope.postMessage({ requestId, error: message });
      });
  };
}

if (typeof self !== 'undefined' && typeof window === 'undefined') {
  attachElkWorker(self as unknown as ElkWorkerScope);
}
