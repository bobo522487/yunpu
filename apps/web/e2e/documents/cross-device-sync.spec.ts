import { expect, test } from '@playwright/test';
import {
  DEFAULT_E2E_PASSWORD,
  ensureLiveProxyHealthy,
  loginUserViaUi,
  registerUserViaUi,
  uniqueEmail,
} from '../auth/helpers';

test.describe('Cross-device Cloud Persistence for Articles and Books', () => {
  test.beforeEach(async ({ request }) => {
    await ensureLiveProxyHealthy(request);
  });

  test('article, revision, book catalog, layout, and edition sync across completely fresh browser contexts without IndexedDB', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const email = uniqueEmail('e2e-cloud-docs');

    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    try {
      await registerUserViaUi(pageA, { email, password: DEFAULT_E2E_PASSWORD });

      await pageA.goto('/projects');
      const demoCard = pageA.locator(
        'article[data-family-name="义门陈氏宗谱（范例）"]',
      );
      await expect(demoCard).toBeVisible({ timeout: 15_000 });
      const projectId = await demoCard.getAttribute('data-family-id');
      expect(projectId).toBeTruthy();

      // 1. Device A: navigate to /articles, create folder + article, edit body, record revision
      await pageA.goto(`/projects/${projectId}/articles`);
      const treePanelA = pageA.getByTestId('article-tree-panel');
      await expect(treePanelA).toBeVisible({ timeout: 15_000 });

      const createFolderRes = pageA.waitForResponse(
        (res) =>
          res.request().method() === 'POST' &&
          /\/api\/v1\/projects\/[^/]+\/folders$/.test(res.url()),
      );
      await treePanelA.getByRole('button', { name: '新建卷目', exact: true }).click();
      expect((await createFolderRes).status()).toBe(201);
      await expect(treePanelA.getByText('新建谱文卷目').first()).toBeVisible();

      await treePanelA.getByRole('button', { name: '新建谱文', exact: true }).click();
      await pageA.locator('#articleMetaTitle').fill('跨设备谱序');
      const createArticleRes = pageA.waitForResponse(
        (res) =>
          res.request().method() === 'POST' &&
          /\/api\/v1\/projects\/[^/]+\/articles$/.test(res.url()),
      );
      await pageA.getByRole('button', { name: '确认', exact: true }).click();
      expect((await createArticleRes).status()).toBe(201);

      const editorA = pageA.locator('.ProseMirror');
      await expect(editorA).toBeVisible({ timeout: 15_000 });
      await editorA.click();

      const patchArticleResA = pageA.waitForResponse(
        (res) =>
          res.request().method() === 'PATCH' &&
          /\/api\/v1\/projects\/[^/]+\/articles\/[^/]+$/.test(res.url()),
      );
      await pageA.keyboard.type('第一设备撰写的宗谱序言。');
      expect((await patchArticleResA).status()).toBe(200);

      // Record a revision on Device A
      const inspectorA = pageA.getByTestId('article-inspector-panel');
      await expect(inspectorA).toBeVisible();
      await inspectorA
        .locator('#articleRevisionSummary')
        .fill('第一设备定稿存底');
      const createRevisionRes = pageA.waitForResponse(
        (res) =>
          res.request().method() === 'POST' &&
          /\/api\/v1\/projects\/[^/]+\/articles\/[^/]+\/revisions$/.test(
            res.url(),
          ),
      );
      await inspectorA.getByRole('button', { name: '记入修订' }).click();
      expect((await createRevisionRes).status()).toBe(201);

      // 2. Device A: navigate to /books, create book, add article to catalog, update layout & generate edition
      await pageA.goto(`/projects/${projectId}/books`);
      await expect(
        pageA.getByRole('button', { name: '创建首部谱书' }),
      ).toBeVisible({ timeout: 15_000 });
      await pageA.getByRole('button', { name: '创建首部谱书' }).click();
      await pageA.locator('#bookMetaName').fill('跨设备修谱集');
      await pageA.locator('#bookMetaHeader').fill('跨设备宗谱');

      const createBookRes = pageA.waitForResponse(
        (res) =>
          res.request().method() === 'POST' &&
          /\/api\/v1\/projects\/[^/]+\/books$/.test(res.url()),
      );
      await pageA.getByRole('button', { name: '确认创建' }).click();
      expect((await createBookRes).status()).toBe(201);

      await expect(pageA.getByText('跨设备修谱集').first()).toBeVisible();

      // Add 跨设备谱序 to book catalog
      await pageA.getByRole('button', { name: '添加谱文' }).first().click();
      const addTextDialog = pageA.getByRole('dialog');
      await expect(addTextDialog).toBeVisible();
      await addTextDialog
        .getByRole('button', { name: /跨设备谱序/ })
        .first()
        .click();

      const patchBookCatalogRes = pageA.waitForResponse(
        (res) =>
          res.request().method() === 'PATCH' &&
          /\/api\/v1\/projects\/[^/]+\/books\/[^/]+$/.test(res.url()),
      );
      await addTextDialog.getByRole('button', { name: /确认加入/ }).click();
      expect((await patchBookCatalogRes).status()).toBe(200);
      await expect(pageA.getByText('跨设备谱序').first()).toBeVisible();

      // Generate book edition snapshot on Device A
      const createEditionRes = pageA.waitForResponse(
        (res) =>
          res.request().method() === 'POST' &&
          /\/api\/v1\/projects\/[^/]+\/books\/[^/]+\/editions$/.test(res.url()),
      );
      await pageA.getByRole('button', { name: '生成谱例' }).click();
      expect((await createEditionRes).status()).toBe(201);
      await expect(pageA.getByText('谱例 #1')).toBeVisible({ timeout: 15_000 });

      // 3. Device B: brand-new isolated browser context (empty cookies/localStorage/IndexedDB)
      const contextB = await browser.newContext();
      const pageB = await contextB.newPage();

      try {
        await pageB.goto('/login');
        const storageBeforeLogin = await pageB.evaluate(async () => {
          const dbs =
            typeof indexedDB.databases === 'function'
              ? await indexedDB.databases()
              : [];
          return {
            dbNames: dbs.map((d) => d.name ?? ''),
            localKeys: Object.keys(window.localStorage),
          };
        });
        expect(storageBeforeLogin.dbNames).not.toContain('yunpu_entity_cache');
        expect(storageBeforeLogin.dbNames).not.toContain('yunpu_article_assets');
        expect(storageBeforeLogin.localKeys).not.toContain('yunpu:articles');
        expect(storageBeforeLogin.localKeys).not.toContain('yunpu:books');

        await loginUserViaUi(pageB, {
          email,
          password: DEFAULT_E2E_PASSWORD,
        });
        await expect(pageB).toHaveURL(/\/home/, { timeout: 20_000 });

        // Device B loads synced article directory, content, and revision
        await pageB.goto(`/projects/${projectId}/articles`);
        const treePanelB = pageB.getByTestId('article-tree-panel');
        await expect(treePanelB.getByText('新建谱文卷目').first()).toBeVisible({
          timeout: 15_000,
        });
        await expect(treePanelB.getByText('跨设备谱序').first()).toBeVisible();
        await treePanelB.getByText('跨设备谱序').first().click();

        const editorB = pageB.locator('.ProseMirror');
        await expect(editorB).toContainText('第一设备撰写的宗谱序言。', {
          timeout: 15_000,
        });

        // Verify revision synced to Device B
        await pageB.getByRole('button', { name: '修订历史' }).click();
        const revModal = pageB.getByTestId('article-revision-modal');
        await expect(revModal).toBeVisible();
        await expect(revModal.getByText('第一设备定稿存底')).toBeVisible({
          timeout: 10_000,
        });
        await revModal.getByRole('button', { name: '关闭', exact: true }).click();

        // Continue editing on Device B and verify server save
        await editorB.click();
        const patchArticleResB = pageB.waitForResponse(
          (res) =>
            res.request().method() === 'PATCH' &&
            /\/api\/v1\/projects\/[^/]+\/articles\/[^/]+$/.test(res.url()),
        );
        await pageB.keyboard.type('第二设备补充修订。');
        expect((await patchArticleResB).status()).toBe(200);

        // Device B verifies synced book, catalog article ref, and edition #1
        await pageB.goto(`/projects/${projectId}/books`);
        await expect(pageB.getByText('跨设备修谱集').first()).toBeVisible({
          timeout: 15_000,
        });
        await expect(pageB.getByText('跨设备谱序').first()).toBeVisible();
        await pageB.getByRole('button', { name: /第三步 查看谱例/ }).click();
        await expect(pageB.getByText('谱例 #1')).toBeVisible({
          timeout: 15_000,
        });

        // Assert zero legacy IndexedDB entity stores exist on Device B
        const storageAfterUse = await pageB.evaluate(async () => {
          const dbs =
            typeof indexedDB.databases === 'function'
              ? await indexedDB.databases()
              : [];
          return {
            dbNames: dbs.map((d) => d.name ?? ''),
            localKeys: Object.keys(window.localStorage),
          };
        });
        expect(storageAfterUse.dbNames).not.toContain('yunpu_entity_cache');
        expect(storageAfterUse.dbNames).not.toContain('yunpu_article_assets');
        expect(storageAfterUse.localKeys).not.toContain('yunpu:articles');
        expect(storageAfterUse.localKeys).not.toContain('yunpu:books');
        expect(storageAfterUse.localKeys).not.toContain('yunpu:article-revisions');
        expect(storageAfterUse.localKeys).not.toContain('yunpu:book-editions');
      } finally {
        await contextB.close();
      }

      // 4. Device A navigates back to /articles and sees Device B's edit synced back from PostgreSQL
      await pageA.goto(`/projects/${projectId}/articles`);
      await pageA
        .getByTestId('article-tree-panel')
        .getByText('跨设备谱序')
        .first()
        .click();
      await expect(pageA.locator('.ProseMirror')).toContainText(
        '第二设备补充修订。',
        { timeout: 15_000 },
      );
    } finally {
      await contextA.close();
    }
  });
});
