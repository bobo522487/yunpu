import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createMemoryArticleAssetStore } from './articleAssetStore.ts';

test('内存图库按 assetId 读写', async () => {
  const store = createMemoryArticleAssetStore();
  await store.put({
    assetId: 'a1',
    contentType: 'image/png',
    bytes: new Uint8Array([1, 2, 3]),
  });
  const found = await store.get('a1');
  assert.equal(found?.contentType, 'image/png');
  assert.deepEqual(found?.bytes, new Uint8Array([1, 2, 3]));
  assert.equal(await store.get('missing'), null);
});