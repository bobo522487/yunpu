import assert from 'node:assert/strict';
import { test } from 'vitest';
import { shouldInitializeProjectSeed } from './hydrationGate.ts';
import { createDebouncedAsyncStorage } from './storageAdapter.ts';

test('createDebouncedAsyncStorage coalesces rapid writes, maintains read-after-write consistency, and flushes cleanly', async () => {
  const backing = new Map<string, string>();
  const batchCalls: Array<{
    entries: Array<[string, string]>;
    deletes: string[];
  }> = [];

  const storage = createDebouncedAsyncStorage({
    writeDelayMs: 40,
    backend: {
      async get(key) {
        return backing.get(key) ?? null;
      },
      async setBatch(entries, deletes) {
        batchCalls.push({ entries, deletes });
        for (const [k, v] of entries) {
          backing.set(k, v);
        }
        for (const k of deletes) {
          backing.delete(k);
        }
      },
      async clearAll() {
        backing.clear();
      },
    },
  });

  await storage.setItem('yunpu:lineage', '{"v":1}');
  await storage.setItem('yunpu:lineage', '{"v":2}');
  await storage.setItem('yunpu:lineage', '{"v":3}');

  // Before flush fires, read-after-write hits pending memory state immediately
  assert.equal(await storage.getItem('yunpu:lineage'), '{"v":3}');
  assert.equal(batchCalls.length, 0);

  await storage.flushPendingWrites();

  // Only one coalesced write with the final payload hits the backend
  assert.equal(batchCalls.length, 1);
  assert.deepEqual(batchCalls[0], {
    entries: [['yunpu:lineage', '{"v":3}']],
    deletes: [],
  });
  assert.equal(backing.get('yunpu:lineage'), '{"v":3}');

  // Removing a key shadows memory & pending writes and flushes as delete
  await storage.removeItem('yunpu:lineage');
  assert.equal(await storage.getItem('yunpu:lineage'), null);
  await storage.flushPendingWrites();
  assert.equal(backing.has('yunpu:lineage'), false);

  // clearAll cancels pending writes, clears memory cache and backing store
  await storage.setItem('yunpu:articles', '{"a":1}');
  await storage.flushPendingWrites();
  await storage.setItem('yunpu:books', '{"b":2}');
  await storage.clearAll();
  assert.equal(await storage.getItem('yunpu:articles'), null);
  assert.equal(await storage.getItem('yunpu:books'), null);
  assert.equal(backing.size, 0);
});

test('shouldInitializeProjectSeed prevents overwriting stored data before IndexedDB rehydration completes', () => {
  // Cold start: not yet hydrated -> never seed even if in-memory entry looks empty
  assert.equal(
    shouldInitializeProjectSeed({
      hasHydrated: false,
      projectId: 'proj-1',
      existingEntry: undefined,
    }),
    false
  );

  // Hydrated and empty -> safe to initialize seed
  assert.equal(
    shouldInitializeProjectSeed({
      hasHydrated: true,
      projectId: 'proj-1',
      existingEntry: undefined,
    }),
    true
  );

  // Hydrated but persisted records already exist -> never overwrite
  assert.equal(
    shouldInitializeProjectSeed({
      hasHydrated: true,
      projectId: 'proj-1',
      existingEntry: [{ id: 'book-1' }],
    }),
    false
  );
});
