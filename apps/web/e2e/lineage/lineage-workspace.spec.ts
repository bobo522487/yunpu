import { expect, test } from '@playwright/test';
import {
  DEFAULT_E2E_PASSWORD,
  ensureLiveProxyHealthy,
  registerUserViaUi,
  uniqueEmail,
} from '../auth/helpers';

test.describe('Lineage Workspace End-to-End Persistence', () => {
  test.beforeEach(async ({ request }) => {
    await ensureLiveProxyHealthy(request);
  });

  test('new user demo project, flat folders, multi-lineage creation, person/alias/event persistence across reload, and delete', async ({
    page,
  }) => {
    const email = uniqueEmail('e2e-lineage');
    await registerUserViaUi(page, { email, password: DEFAULT_E2E_PASSWORD });

    // 1. Verify pre-seeded demo family project exists on /projects
    await page.goto('/projects');
    const demoCard = page.locator(
      'article[data-family-name="义门陈氏宗谱（范例）"]',
    );
    await expect(demoCard).toBeVisible({ timeout: 15_000 });
    const demoProjectId = await demoCard.getAttribute('data-family-id');
    expect(demoProjectId).toBeTruthy();

    // Enter demo lineage workspace directly
    await page.goto(`/projects/${demoProjectId}/lineage`);
    await expect(page.getByText('总世系与支系')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('义门陈氏总世系')).toBeVisible();
    await expect(
      page.locator('[role="group"][aria-label*="陈旺"]'),
    ).toBeVisible({ timeout: 15_000 });

    // 2. Create a flat folder in LineageTreePanel
    const createFolderRes = page.waitForResponse(
      (res) =>
        res.request().method() === 'POST' &&
        /\/api\/v1\/projects\/[^/]+\/folders$/.test(res.url()),
    );
    await page.getByRole('button', { name: '新建分组', exact: true }).click();
    expect((await createFolderRes).status()).toBe(201);
    await expect(page.getByText('新建世系分组').first()).toBeVisible();

    // 3. Create a second lineage with a progenitor person
    await page.getByRole('button', { name: '新建世系', exact: true }).click();
    await page.locator('#addLineageName').fill('德安分房世系');
    await page.locator('#addLineageSurname').fill('陈');
    await page.locator('#addLineageProgenitor').fill('陈分祖');

    const createLineageRes = page.waitForResponse(
      (res) =>
        res.request().method() === 'POST' &&
        /\/api\/v1\/projects\/[^/]+\/lineages$/.test(res.url()),
    );
    await page.locator('#lineageModalSubmitBtn').click();
    expect((await createLineageRes).status()).toBe(201);

    await expect(
      page.locator('[role="group"][aria-label*="陈分祖"]'),
    ).toBeVisible({ timeout: 15_000 });

    // Reload and confirm both folder & second lineage remain persisted
    await page.reload();
    await expect(page.getByText('新建世系分组').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('德安分房世系').first()).toBeVisible();

    // 4. Delete pre-seeded folder and confirm contained lineage remains unbound at root
    const folderRow = page.locator('li', { hasText: '总世系与支系' }).first();
    await folderRow.hover();
    await folderRow.locator('button[title="更多操作"]').click();
    const deleteFolderRes = page.waitForResponse(
      (res) =>
        res.request().method() === 'DELETE' &&
        /\/api\/v1\/projects\/[^/]+\/folders\/[^/]+$/.test(res.url()),
    );
    await page.getByRole('button', { name: '删除', exact: true }).click();
    expect((await deleteFolderRes).status()).toBe(200);

    await expect(page.getByText('总世系与支系')).toHaveCount(0);
    await expect(page.getByText('义门陈氏总世系').first()).toBeVisible();

    // 5. Switch back to 义门陈氏总世系, select 陈旺, add child + alias + event
    await page.getByText('义门陈氏总世系').first().click();
    const chenWangNode = page.locator('[role="group"][aria-label*="陈旺"]');
    await expect(chenWangNode).toBeVisible({ timeout: 15_000 });
    await chenWangNode.click();

    const drawer = page.getByRole('complementary', { name: '人物详情抽屉' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText('子兴')).toBeVisible();

    // Add child via PersonDetailPanel
    await drawer.getByTestId('add-child').click();
    await page.getByTestId('zh-first-name').fill('季常');
    const createChildRes = page.waitForResponse(
      (res) =>
        res.request().method() === 'POST' &&
        /\/api\/v1\/projects\/[^/]+\/persons$/.test(res.url()),
    );
    const createRelRes = page.waitForResponse(
      (res) =>
        res.request().method() === 'POST' &&
        /\/api\/v1\/projects\/[^/]+\/relations$/.test(res.url()),
    );
    await page.getByRole('button', { name: '保存并加入' }).click();
    expect((await createChildRes).status()).toBe(201);
    expect((await createRelRes).status()).toBe(201);
    await expect(
      page.locator('[role="group"][aria-label*="陈季常"]'),
    ).toBeVisible({ timeout: 15_000 });

    // Add alias to 陈旺 (now auto-selected or re-select 陈旺)
    await chenWangNode.click();
    await drawer.getByTestId('add-alias-button').click();
    await page.getByPlaceholder('如：伯宣、竹溪').fill('义门公');
    const createNameRes = page.waitForResponse(
      (res) =>
        res.request().method() === 'POST' &&
        /\/api\/v1\/projects\/[^/]+\/persons\/[^/]+\/names$/.test(res.url()),
    );
    await page.getByRole('button', { name: '保存', exact: true }).click();
    expect((await createNameRes).status()).toBe(201);
    await expect(drawer.getByText('义门公')).toBeVisible();

    // Add life event to 陈旺
    await drawer
      .locator('section', { hasText: '时间线' })
      .getByRole('button', { name: '新增' })
      .click();
    await page
      .getByPlaceholder('填写该事件的经过、学校/单位/职衔、功名或谱牒记述...')
      .fill('立义门家法三十三条');
    const createEventRes = page.waitForResponse(
      (res) =>
        res.request().method() === 'POST' &&
        /\/api\/v1\/projects\/[^/]+\/persons\/[^/]+\/events$/.test(res.url()),
    );
    await page.getByRole('button', { name: '保存事件' }).click();
    expect((await createEventRes).status()).toBe(201);
    await expect(drawer.getByText('立义门家法三十三条')).toBeVisible();

    // 6. Reload and verify all genealogy mutations persist in PostgreSQL
    await page.reload();
    await page.getByText('义门陈氏总世系').first().click();
    await expect(
      page.locator('[role="group"][aria-label*="陈季常"]'),
    ).toBeVisible({ timeout: 15_000 });
    await page.locator('[role="group"][aria-label*="陈旺"]').click();
    await expect(drawer.getByText('义门公')).toBeVisible({ timeout: 15_000 });
    await expect(drawer.getByText('立义门家法三十三条')).toBeVisible();

    // 7. Delete the demo project cleanly and verify absence after reload
    await page.goto('/projects');
    await expect(demoCard).toBeVisible({ timeout: 15_000 });
    await demoCard.getByRole('button', { name: '删除家族' }).click();
    await page.getByRole('button', { name: '删除', exact: true }).click();
    await expect(demoCard).toHaveCount(0, { timeout: 15_000 });
    await page.reload();
    await expect(demoCard).toHaveCount(0, { timeout: 15_000 });
  });
});
