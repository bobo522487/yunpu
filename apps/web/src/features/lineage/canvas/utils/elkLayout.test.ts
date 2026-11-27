import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker as NodeWorker } from 'node:worker_threads';
import { afterEach, describe, expect, test } from 'vitest';
import { type PersonRecord } from '../../types';
import { type GenealogyFlowEdge, type GenealogyFlowNode } from '../types';
import {
  type ElkWorkerLike,
  type ElkWorkerRequest,
  type ElkWorkerResponse,
  ElkLayoutCancelledError,
  createDefaultElkWorker,
  createElkLayoutRunner,
  isElkLayoutCancelledError,
  layoutWithElk,
} from './elkLayout';
import { FS_CARD_H, FS_CARD_W, buildGenealogyGraph } from './layoutBuilder';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(CURRENT_DIR, '../../../../../../../');
const TS_EXT_REGISTER = path.join(REPO_ROOT, 'scripts/ts-ext-register.mjs');
const ELK_WORKER_MODULE_URL = pathToFileURL(
  path.join(CURRENT_DIR, 'elkLayout.worker.ts')
).href;

/**
 * Wraps a real Node `worker_threads` background thread executing
 * `elkLayout.worker.ts` behind the `ElkWorkerLike` boundary so Vitest unit
 * tests exercise real `elkjs` off the main thread.
 */
function createNodeThreadWorker(): ElkWorkerLike {
  const bootstrap = `
    import { parentPort } from 'node:worker_threads';
    import { createElkLayoutExecutor } from ${JSON.stringify(ELK_WORKER_MODULE_URL)};

    const executeLayout = createElkLayoutExecutor();
    parentPort.on('message', (msg) => {
      void executeLayout(msg.graph)
        .then((layouted) => {
          parentPort.postMessage({ requestId: msg.requestId, layouted });
        })
        .catch((error) => {
          parentPort.postMessage({
            requestId: msg.requestId,
            error: error instanceof Error ? error.message : 'ELK worker failed',
          });
        });
    });
  `;

  const thread = new NodeWorker(bootstrap, {
    eval: true,
    execArgv: ['--import', TS_EXT_REGISTER],
  });

  const adapter: ElkWorkerLike = {
    onmessage: null,
    onerror: null,
    postMessage(message: ElkWorkerRequest) {
      thread.postMessage(message);
    },
    terminate() {
      void thread.terminate();
    },
  };

  thread.on('message', (data: ElkWorkerResponse) => {
    adapter.onmessage?.({ data } as MessageEvent<ElkWorkerResponse>);
  });

  thread.on('error', (error: Error) => {
    adapter.onerror?.({
      message: error.message,
      error,
    } as ErrorEvent);
  });

  return adapter;
}

function makeSamplePersons(count: number): PersonRecord[] {
  const persons: PersonRecord[] = [];
  for (let i = 0; i < count; i += 1) {
    const id = `p-${i}`;
    const generation = Math.floor(Math.log2(i + 1)) + 1;
    const fatherIdx = i === 0 ? null : Math.floor((i - 1) / 2);
    persons.push({
      id,
      branchId: 'branch-1',
      name: `族人${i}`,
      surname: '陈',
      gender: 'male',
      generation,
      status: 'living',
      fatherId: fatherIdx === null ? null : `p-${fatherIdx}`,
      siblingOrder: i % 2 === 1 ? 1 : 2,
    });
  }
  return persons;
}

function makeControlledWorker() {
  const posted: ElkWorkerRequest[] = [];
  let terminated = 0;

  const worker: ElkWorkerLike = {
    onmessage: null,
    onerror: null,
    postMessage(message: ElkWorkerRequest) {
      posted.push(message);
    },
    terminate() {
      terminated += 1;
    },
  };

  return {
    worker,
    posted,
    getTerminatedCount: () => terminated,
    emitResponse(response: ElkWorkerResponse) {
      worker.onmessage?.({ data: response } as MessageEvent<ElkWorkerResponse>);
    },
    emitError(message: string) {
      worker.onerror?.({ message } as ErrorEvent);
    },
  };
}

describe('elkLayout Web Worker migration', () => {
  const activeRunners: Array<{ dispose: () => void }> = [];

  afterEach(() => {
    while (activeRunners.length > 0) {
      activeRunners.pop()?.dispose();
    }
  });

  test('fails explicitly without hidden main-thread fallback when Web Worker is unavailable', async () => {
    assert.equal(typeof Worker, 'undefined');
    assert.throws(() => createDefaultElkWorker(), /Web Worker is unavailable/);

    const persons = makeSamplePersons(3);
    const { nodes, edges } = buildGenealogyGraph(persons, { clanSurname: '陈' });

    await expect(layoutWithElk(nodes, edges)).rejects.toThrow(
      /Web Worker is unavailable/
    );
  });

  test('returns empty array for empty nodes without spawning a worker', async () => {
    let factoryCalls = 0;
    const runner = createElkLayoutRunner({
      workerFactory: () => {
        factoryCalls += 1;
        return makeControlledWorker().worker;
      },
    });
    activeRunners.push(runner);

    const result = await runner.layout([], []);
    assert.deepEqual(result, []);
    assert.equal(factoryCalls, 0);
  });

  test('computes valid non-overlapping layered coordinates and clanHeader offset via real elkjs worker thread', async () => {
    const runner = createElkLayoutRunner({
      workerFactory: createNodeThreadWorker,
    });
    activeRunners.push(runner);

    const persons: PersonRecord[] = [
      {
        id: 'p-root',
        branchId: 'branch-1',
        name: '陈旺',
        surname: '陈',
        gender: 'male',
        generation: 1,
        status: 'deceased',
        fatherId: null,
      },
      {
        id: 'p-spouse',
        branchId: 'branch-1',
        name: '王氏',
        surname: '王',
        gender: 'female',
        generation: 1,
        status: 'deceased',
        spouseOfId: 'p-root',
        fatherId: null,
      },
      {
        id: 'p-c1',
        branchId: 'branch-1',
        name: '陈甲',
        surname: '陈',
        gender: 'male',
        generation: 2,
        status: 'deceased',
        fatherId: 'p-root',
        motherId: 'p-spouse',
        siblingOrder: 1,
      },
      {
        id: 'p-c2',
        branchId: 'branch-1',
        name: '陈乙',
        surname: '陈',
        gender: 'male',
        generation: 2,
        status: 'deceased',
        fatherId: 'p-root',
        motherId: 'p-spouse',
        siblingOrder: 2,
      },
      {
        id: 'p-gc1',
        branchId: 'branch-1',
        name: '陈丙',
        surname: '陈',
        gender: 'male',
        generation: 3,
        status: 'living',
        fatherId: 'p-c1',
        siblingOrder: 1,
      },
    ];

    const onSelect = () => {};
    const graph = buildGenealogyGraph(persons, {
      clanSurname: '陈',
      onSelectPerson: onSelect,
    });

    // Scramble input coordinates to confirm ELK replaces positions
    const scrambledNodes = graph.nodes.map((n) => ({
      ...n,
      position: { x: 0, y: 0 },
    }));

    const layouted = await runner.layout(scrambledNodes, graph.edges);
    assert.equal(layouted.length, graph.nodes.length);

    const byId = new Map(layouted.map((n) => [n.id, n]));
    const rootNode = byId.get('p-root');
    const c1Node = byId.get('p-c1');
    const c2Node = byId.get('p-c2');
    const gc1Node = byId.get('p-gc1');
    const headerNode = byId.get('clan-header-p-root');

    assert.ok(rootNode && c1Node && c2Node && gc1Node && headerNode);
    assert.equal(rootNode.type, 'person');
    assert.equal(rootNode.data.onSelect, onSelect);
    assert.ok(rootNode.position.y < c1Node.position.y);
    assert.ok(c1Node.position.y < gc1Node.position.y);

    // Sibling cards in the same generation must not overlap horizontally
    const horizontalGap = Math.abs(c1Node.position.x - c2Node.position.x);
    assert.ok(
      horizontalGap >= FS_CARD_W,
      `Expected siblings separated by >= ${FS_CARD_W}px, got ${horizontalGap}`
    );

    // Clan header positioned directly above root card
    assert.equal(headerNode.position.x, rootNode.position.x + FS_CARD_W / 2 - 120);
    assert.equal(headerNode.position.y, rootNode.position.y - 58);

    // All person cards have non-overlapping bounding boxes
    const personNodes = layouted.filter((n) => n.type === 'person');
    for (let i = 0; i < personNodes.length; i += 1) {
      for (let j = i + 1; j < personNodes.length; j += 1) {
        const a = personNodes[i];
        const b = personNodes[j];
        const overlapsX =
          a.position.x < b.position.x + FS_CARD_W &&
          a.position.x + FS_CARD_W > b.position.x;
        const overlapsY =
          a.position.y < b.position.y + FS_CARD_H &&
          a.position.y + FS_CARD_H > b.position.y;
        assert.equal(
          overlapsX && overlapsY,
          false,
          `Nodes ${a.id} and ${b.id} overlap`
        );
      }
    }

    // Sequential follow-up layout on the same worker continues to work reliably
    const secondLayout = await runner.layout(scrambledNodes, graph.edges);
    assert.equal(secondLayout.length, graph.nodes.length);
  });

  test('cancels superseded requests and discards out-of-order stale worker responses', async () => {
    const controlled = makeControlledWorker();
    const runner = createElkLayoutRunner({
      workerFactory: () => controlled.worker,
    });
    activeRunners.push(runner);

    const g1 = buildGenealogyGraph(makeSamplePersons(2), { clanSurname: '陈' });
    const g2 = buildGenealogyGraph(makeSamplePersons(3), { clanSurname: '陈' });
    const g3 = buildGenealogyGraph(makeSamplePersons(4), { clanSurname: '陈' });

    const p1 = runner.layout(g1.nodes, g1.edges);
    const p2 = runner.layout(g2.nodes, g2.edges);
    const p3 = runner.layout(g3.nodes, g3.edges);

    assert.equal(controlled.posted.length, 3);
    assert.deepEqual(
      controlled.posted.map((m) => m.requestId),
      [1, 2, 3]
    );

    await expect(p1).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof ElkLayoutCancelledError && err.reason === 'superseded'
    );
    await expect(p2).rejects.toSatisfy(
      (err: unknown) =>
        isElkLayoutCancelledError(err) && err.reason === 'superseded'
    );

    // Stale responses arriving out of order must be silently ignored
    controlled.emitResponse({
      requestId: 2,
      layouted: { id: 'root', children: [{ id: 'p-0', x: 9999, y: 9999 }] },
    });
    controlled.emitResponse({
      requestId: 1,
      layouted: { id: 'root', children: [{ id: 'p-0', x: 8888, y: 8888 }] },
    });

    // Latest generation response resolves p3 with p3's coordinates
    controlled.emitResponse({
      requestId: 3,
      layouted: {
        id: 'root',
        children: [
          { id: 'p-0', x: 100, y: 50 },
          { id: 'p-1', x: 20, y: 300 },
          { id: 'p-2', x: 200, y: 300 },
          { id: 'p-3', x: 20, y: 550 },
        ],
      },
    });

    const result3 = await p3;
    const p0Node = result3.find((n) => n.id === 'p-0');
    assert.ok(p0Node);
    assert.deepEqual(p0Node.position, { x: 100, y: 50 });

    // Late stale response after completion must not affect anything
    controlled.emitResponse({
      requestId: 1,
      layouted: { id: 'root', children: [{ id: 'p-0', x: 7777, y: 7777 }] },
    });
  });

  test('supports AbortSignal cancellation and recovers cleanly after worker errors', async () => {
    const workers: ReturnType<typeof makeControlledWorker>[] = [];
    const runner = createElkLayoutRunner({
      workerFactory: () => {
        const w = makeControlledWorker();
        workers.push(w);
        return w.worker;
      },
    });
    activeRunners.push(runner);

    const { nodes, edges } = buildGenealogyGraph(makeSamplePersons(2), {
      clanSurname: '陈',
    });

    // Pre-aborted signal rejects without spawning or posting to worker
    const preAborted = new AbortController();
    preAborted.abort();
    await expect(
      runner.layout(nodes, edges, { signal: preAborted.signal })
    ).rejects.toSatisfy(
      (err: unknown) =>
        isElkLayoutCancelledError(err) && err.reason === 'aborted'
    );
    assert.equal(workers.length, 0);

    // In-flight abort rejects and discards late reply
    const inFlight = new AbortController();
    const pendingPromise = runner.layout(nodes, edges, {
      signal: inFlight.signal,
    });
    assert.equal(workers.length, 1);
    inFlight.abort();

    await expect(pendingPromise).rejects.toSatisfy(
      (err: unknown) =>
        isElkLayoutCancelledError(err) && err.reason === 'aborted'
    );

    workers[0].emitResponse({
      requestId: workers[0].posted[0].requestId,
      layouted: { id: 'root', children: [{ id: 'p-0', x: 555, y: 555 }] },
    });

    // Worker error rejects visibly, terminates broken worker, and next call spawns a fresh worker
    const failingPromise = runner.layout(nodes, edges);
    workers[0].emitError('worker crashed');
    await expect(failingPromise).rejects.toThrow(/worker crashed/);
    assert.equal(workers[0].getTerminatedCount(), 1);

    const recoveryPromise = runner.layout(nodes, edges);
    assert.equal(workers.length, 2);
    workers[1].emitResponse({
      requestId: workers[1].posted[0].requestId,
      layouted: { id: 'root', children: [{ id: 'p-0', x: 42, y: 84 }] },
    });
    const recovered = await recoveryPromise;
    assert.deepEqual(recovered.find((n) => n.id === 'p-0')?.position, {
      x: 42,
      y: 84,
    });
  });

  test('500-node ELK layout dispatches with < 16ms main-thread synchronous blocking', async () => {
    let applySyncMs = 0;
    const runner = createElkLayoutRunner({
      workerFactory: () => {
        const realWorker = createNodeThreadWorker();
        return {
          get onmessage() {
            return realWorker.onmessage;
          },
          set onmessage(handler) {
            if (!handler) {
              realWorker.onmessage = null;
              return;
            }
            realWorker.onmessage = (event) => {
              const start = performance.now();
              handler(event);
              applySyncMs = performance.now() - start;
            };
          },
          get onerror() {
            return realWorker.onerror;
          },
          set onerror(handler) {
            realWorker.onerror = handler;
          },
          postMessage(msg) {
            realWorker.postMessage(msg);
          },
          terminate() {
            realWorker.terminate();
          },
        };
      },
    });
    activeRunners.push(runner);

    const persons500 = makeSamplePersons(500);
    const graph500 = buildGenealogyGraph(persons500, { clanSurname: '陈' });
    const nodes500: GenealogyFlowNode[] = graph500.nodes;
    const edges500: GenealogyFlowEdge[] = graph500.edges;
    assert.ok(
      nodes500.length >= 500,
      `Expected >= 500 graph nodes, got ${nodes500.length}`
    );

    const syncStart = performance.now();
    const layoutPromise = runner.layout(nodes500, edges500);
    const syncDispatchMs = performance.now() - syncStart;

    let mainThreadTickRanBeforeLayoutDone = false;
    let layoutSettled = false;
    const tickPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        if (!layoutSettled) {
          mainThreadTickRanBeforeLayoutDone = true;
        }
        resolve();
      }, 0);
    });

    const layouted = await layoutPromise;
    layoutSettled = true;
    await tickPromise;

    assert.equal(layouted.length, nodes500.length);
    const personNodes = layouted.filter((n) => n.type === 'person');
    assert.equal(personNodes.length, 500);
    assert.ok(
      personNodes.every(
        (n) => Number.isFinite(n.position.x) && Number.isFinite(n.position.y)
      )
    );

    const totalMainThreadSyncMs = syncDispatchMs + applySyncMs;
    assert.ok(
      syncDispatchMs < 16,
      `Expected synchronous main-thread dispatch < 16ms for 500 nodes, got ${syncDispatchMs.toFixed(2)}ms`
    );
    assert.ok(
      totalMainThreadSyncMs < 16,
      `Expected total synchronous main-thread work < 16ms for 500 nodes, got ${totalMainThreadSyncMs.toFixed(2)}ms`
    );
    assert.equal(
      mainThreadTickRanBeforeLayoutDone,
      true,
      'Main thread event loop must remain unblocked while worker computes 500-node ELK layout'
    );
  });
});
