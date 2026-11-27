import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { ArticleDocument } from '../types';
import type { ArticleWriteRequest } from '../api';
import { createArticleWrite } from './articleWrite.ts';

const existing: ArticleDocument = {
  id: 'a1',
  title: '旧题',
  subtitle: '',
  author: '',
  docType: 'custom',
  status: 'draft',
  privacy: 'clan',
  contentHtml: '<p>旧</p>',
  linkedPersonIds: [],
  linkedChartIds: [],
  citations: [],
  version: 3,
  wordCount: 1,
  updatedAt: '2024-01-01 00:00',
};

test('local 模式下提交谱文会抬版本，且不请求保存', async () => {
  let called = false;
  const write = createArticleWrite(async () => {
    called = true;
    return { ok: true, article: existing };
  });

  const next = write.commitContent({
    projectId: 'p1',
    articleId: 'a1',
    existing,
    updates: { title: '新题' },
    mode: 'local',
    updatedAt: '2026-11-24 21:00',
    readCurrent: () => existing,
    handlers: {
      onSuccess: () => assert.fail('local 不应收到保存结果'),
      onConflict: () => assert.fail('local 不应冲突'),
    },
  });

  await Promise.resolve();
  assert.equal(next.version, 4);
  assert.equal(next.title, '新题');
  assert.equal(next.updatedAt, '2026-11-24 21:00');
  assert.equal(called, false);
});

test('network 模式下提交谱文不抬本地版本，并按当时的版本请求保存', async () => {
  const sent: { request: ArticleWriteRequest | null } = { request: null };
  let current = existing;
  const saved = new Promise<ArticleDocument>((resolve, reject) => {
    const write = createArticleWrite(async (request) => {
      sent.request = request;
      return { ok: true, article: { ...request.article, version: request.expectedVersion + 1 } };
    });
    const next = write.commitContent({
      projectId: 'p1',
      articleId: 'a1',
      existing,
      updates: { title: '新题' },
      mode: 'network',
      updatedAt: '2026-11-24 21:00',
      readCurrent: () => current,
      handlers: {
        onSuccess: resolve,
        onConflict: () => reject(new Error('不应冲突')),
        onError: () => reject(new Error('不应失败')),
      },
    });
    current = next;
    assert.equal(next.version, 3);
    assert.equal(next.title, '新题');
  });

  const article = await saved;
  const request = sent.request;
  if (!request) throw new Error('应当发出保存请求');
  assert.equal(request.expectedVersion, 3);
  assert.equal(request.article.version, 3);
  assert.equal(request.article.title, '新题');
  assert.equal(article.version, 4);
});

test('保存返回 409 时进入谱文冲突，且不把服务器正文当成成功', async () => {
  const server = { ...existing, version: 9, title: '服务器' };
  const conflict = new Promise<ArticleDocument>((resolve, reject) => {
    const write = createArticleWrite(async () => ({
      ok: false,
      status: 409,
      server,
    }));
    write.commitContent({
      projectId: 'p1',
      articleId: 'a1',
      existing,
      updates: { title: '本地新题' },
      mode: 'network',
      updatedAt: '2026-11-24 21:00',
      readCurrent: () => existing,
      handlers: {
        onSuccess: () => reject(new Error('不应成功')),
        onConflict: resolve,
      },
    });
  });

  const serverArticle = await conflict;
  assert.equal(serverArticle.title, '服务器');
  assert.equal(serverArticle.version, 9);
});

test('保存失败时不替换谱文', async () => {
  let failedVersion: number | null = null;
  const write = createArticleWrite(async () => {
    throw new Error('network');
  });
  const next = write.commitContent({
    projectId: 'p1',
    articleId: 'a1',
    existing,
    updates: { title: '新题' },
    mode: 'network',
    updatedAt: '2026-11-24 21:00',
    readCurrent: () => ({ ...existing, title: '新题' }),
    handlers: {
      onSuccess: () => assert.fail('不应成功'),
      onConflict: () => assert.fail('不应冲突'),
      onError: (expectedVersion) => {
        failedVersion = expectedVersion;
      },
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(next.version, 3);
  assert.equal(failedVersion, 3);
});

test('过期的 200 只推进版本，后续保存使用新版本', async () => {
  let current: ArticleDocument = { ...existing, title: '一' };
  const versionsSent: number[] = [];
  let releaseFirst: () => void = () => undefined;
  const firstHeld = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let write: ReturnType<typeof createArticleWrite> = createArticleWrite(async () => {
    throw new Error('尚未装上保存');
  });
  const finished = new Promise<ArticleDocument>((resolve, reject) => {
    write = createArticleWrite(async (request) => {
      versionsSent.push(request.expectedVersion);
      if (versionsSent.length === 1) {
        const second = write.commitContent({
          projectId: 'p1',
          articleId: 'a1',
          existing: current,
          updates: { title: '二' },
          mode: 'network',
          updatedAt: '2026-11-24 21:01',
          readCurrent: () => current,
          handlers: {
            onSuccess: resolve,
            onConflict: () => reject(new Error('不应冲突')),
            onSupersededSuccess: (article) => {
              current = { ...current, version: article.version };
            },
          },
        });
        current = second;
        releaseFirst();
      }
      if (versionsSent.length === 1) await firstHeld;
      return {
        ok: true,
        article: { ...request.article, version: request.expectedVersion + 1 },
      };
    });
    const first = write.commitContent({
      projectId: 'p1',
      articleId: 'a1',
      existing,
      updates: { title: '一' },
      mode: 'network',
      updatedAt: '2026-11-24 21:00',
      readCurrent: () => current,
      handlers: {
        onSuccess: () => reject(new Error('过期保存不应替换正文')),
        onConflict: () => reject(new Error('不应冲突')),
      },
    });
    current = first;
  });

  const article = await finished;
  assert.deepEqual(versionsSent, [3, 4]);
  assert.equal(article.version, 5);
  assert.equal(article.title, '二');
});

test('取服务器时采用服务器谱文，并作废进行中的保存', async () => {
  let saves = 0;
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started: () => void = () => undefined;
  const startedPromise = new Promise<void>((resolve) => {
    started = resolve;
  });
  let replaced = false;
  const write = createArticleWrite(async () => {
    saves += 1;
    started();
    await held;
    return { ok: true, article: { ...existing, version: 4, title: '过期成功' } };
  });
  write.commitContent({
    projectId: 'p1',
    articleId: 'a1',
    existing,
    updates: { title: '本地新题' },
    mode: 'network',
    updatedAt: '2026-11-24 21:00',
    readCurrent: () => existing,
    handlers: {
      onSuccess: () => {
        replaced = true;
      },
      onConflict: () => assert.fail('不应冲突'),
    },
  });
  await startedPromise;
  const server = { ...existing, version: 8, title: '服务器' };
  const adopted = write.resolveConflict({
    choice: 'take-server',
    projectId: 'p1',
    articleId: 'a1',
    local: { ...existing, title: '本地新题' },
    server,
    mode: 'network',
    updatedAt: '2026-11-24 21:02',
    readCurrent: () => server,
    handlers: {
      onSuccess: () => assert.fail('取服务器不应再保存'),
      onConflict: () => assert.fail('不应冲突'),
    },
  });
  release();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(adopted.title, '服务器');
  assert.equal(adopted.version, 8);
  assert.equal(saves, 1);
  assert.equal(replaced, false);
});

test('留本地时保留本地正文，改用服务器版本并再次保存', async () => {
  const sent: { request: ArticleWriteRequest | null } = { request: null };
  let current: ArticleDocument | undefined;
  const saved = new Promise<ArticleDocument>((resolve, reject) => {
    const write = createArticleWrite(async (request) => {
      sent.request = request;
      return {
        ok: true,
        article: { ...request.article, version: request.expectedVersion + 1 },
      };
    });
    const resolved = write.resolveConflict({
      choice: 'keep-local',
      projectId: 'p1',
      articleId: 'a1',
      local: { ...existing, title: '本地', version: 3 },
      server: { ...existing, title: '服务器', version: 8 },
      mode: 'network',
      updatedAt: '2026-11-24 21:02',
      readCurrent: () => current,
      handlers: {
        onSuccess: resolve,
        onConflict: () => reject(new Error('不应冲突')),
      },
    });
    current = resolved;
    assert.equal(resolved.title, '本地');
    assert.equal(resolved.version, 8);
  });

  const article = await saved;
  const request = sent.request;
  if (!request) throw new Error('应当再次保存');
  assert.equal(request.expectedVersion, 8);
  assert.equal(request.article.title, '本地');
  assert.equal(article.version, 9);
});

test('作废后，进行中的成功不再替换谱文', async () => {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let replaced = false;
  const write = createArticleWrite(async () => {
    await held;
    return { ok: true, article: { ...existing, version: 4, title: '迟到' } };
  });
  write.commitContent({
    projectId: 'p1',
    articleId: 'a1',
    existing,
    updates: { title: '本地新题' },
    mode: 'network',
    updatedAt: '2026-11-24 21:00',
    readCurrent: () => existing,
    handlers: {
      onSuccess: () => {
        replaced = true;
      },
      onConflict: () => assert.fail('不应冲突'),
    },
  });
  write.invalidate('p1', 'a1');
  release();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(replaced, false);
});
