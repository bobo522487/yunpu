import '../extensions/articleSchema.happy-dom.ts';
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createInitialArticleSeed } from '../articleData.ts';
import { ARTICLE_TEMPLATES, getArticleTemplate } from './articleTemplates.ts';

const ctx = {
  familyName: '陈氏',
  surname: '陈',
  hallName: '德星堂',
  ancestor: '陈伯温',
  region: null,
};

test('八个模板都能生成非空正文', () => {
  assert.equal(ARTICLE_TEMPLATES.length, 8);
  for (const template of ARTICLE_TEMPLATES) {
    const html = template.buildContent(ctx);
    assert.equal(html.includes('<'), true, template.id);
  }
  assert.equal(getArticleTemplate('donors')?.name, '捐资芳名录');
  assert.equal(getArticleTemplate('blank')?.buildContent(ctx), '<p></p>');
});

test('种子谱文改为模板投影并带上文体', () => {
  const seed = createInitialArticleSeed('proj-1', ctx);
  const preface = seed.articles['proj-1::article-preface'];
  assert.equal(preface.docType, 'preface');
  assert.equal(preface.status, 'draft');
  assert.equal(preface.privacy, 'clan');
  assert.equal(preface.version, 1);
  assert.equal(preface.contentJson?.type, 'doc');
  assert.match(preface.contentHtml, /修谱缘起/);
  assert.ok(preface.wordCount > 20);
});