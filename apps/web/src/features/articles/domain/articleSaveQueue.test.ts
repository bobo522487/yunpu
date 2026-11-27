import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import { createArticleSaveQueue } from './articleSaveQueue.ts';

test('连续编辑只在定时器触发时提交一次', () => {
  const commits: string[] = [];
  let scheduled: (() => void) | null = null;
  const queue = createArticleSaveQueue({
    delayMs: 800,
    schedule: (fn, _ms) => {
      scheduled = fn;
      return 1;
    },
    cancel: () => {
      scheduled = null;
    },
    projectHtml: () => '<p>乙</p>',
    onCommit: (commit) => commits.push(commit.contentHtml),
  });
  const first: JSONContent = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: '甲' }] }],
  };
  const second: JSONContent = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: '乙' }] }],
  };
  queue.noteEdit('a1', () => first);
  queue.noteEdit('a1', () => second);
  assert.equal(commits.length, 0);
  assert.ok(scheduled);
  const fire = scheduled as () => void;
  fire();
  assert.deepEqual(commits, ['<p>乙</p>']);
});

test('flush 立即提交并取消定时器', () => {
  const commits: number[] = [];
  let scheduled: (() => void) | null = null;
  const queue = createArticleSaveQueue({
    delayMs: 800,
    schedule: (fn, _ms) => {
      scheduled = fn;
      return 7;
    },
    cancel: () => {
      scheduled = null;
    },
    projectHtml: () => '<p>谱</p>',
    onCommit: (commit) => commits.push(commit.wordCount),
  });
  queue.noteEdit('a1', () => ({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: '谱' }] }],
  }));
  queue.flush();
  assert.deepEqual(commits, [1]);
  assert.equal(scheduled, null);
  assert.equal(queue.flush(), null);
});

test('flush 提交携带的 articleId 与队列编辑篇章一致', () => {
  const commits: Array<{ articleId: string; wordCount: number }> = [];
  const queue = createArticleSaveQueue({
    delayMs: 800,
    schedule: (fn) => {
      void fn;
      return 1;
    },
    cancel: () => undefined,
    projectHtml: () => '<p>乙</p>',
    onCommit: (commit) =>
      commits.push({ articleId: commit.articleId, wordCount: commit.wordCount }),
  });
  queue.noteEdit('article-a', () => ({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: '乙' }] }],
  }));
  queue.flush();
  assert.equal(commits.length, 1);
  assert.equal(commits[0]?.articleId, 'article-a');
});