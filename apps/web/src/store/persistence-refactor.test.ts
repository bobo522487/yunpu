import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  createAppStorage,
  defaultStorageAdapter,
  type StorageAdapter,
} from './storageAdapter.ts';
import { useArticleStore } from './useArticleStore.ts';
import { useBookStore } from './useBookStore.ts';
import { useLineageStore } from './useLineageStore.ts';

test('createAppStorage delegates read/write/remove to synchronous UI StorageAdapter', () => {
  const backing = new Map<string, string>();
  const adapter: StorageAdapter = {
    getItem: (key) => backing.get(key) ?? null,
    setItem: (key, value) => {
      backing.set(key, value);
    },
    removeItem: (key) => {
      backing.delete(key);
    },
  };

  const storage = createAppStorage<{ theme: string }>(adapter);
  assert.ok(storage);

  storage.setItem('yunpu:ui-prefs', { state: { theme: 'dark' }, version: 0 });
  assert.deepEqual(storage.getItem('yunpu:ui-prefs'), {
    state: { theme: 'dark' },
    version: 0,
  });

  storage.removeItem('yunpu:ui-prefs');
  assert.equal(storage.getItem('yunpu:ui-prefs'), null);
});

test('defaultStorageAdapter handles non-browser environment without IndexedDB', () => {
  assert.equal(defaultStorageAdapter.getItem('missing-key'), null);
  defaultStorageAdapter.setItem('test-key', 'value');
  defaultStorageAdapter.removeItem('test-key');
});

test('domain UI stores do not attach persist middleware or retain entity caches', () => {
  assert.equal('persist' in useLineageStore, false);
  assert.equal('persist' in useArticleStore, false);
  assert.equal('persist' in useBookStore, false);
});
