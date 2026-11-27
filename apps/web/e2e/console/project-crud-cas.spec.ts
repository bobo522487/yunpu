import { expect, test } from '@playwright/test';
import {
  DEFAULT_E2E_PASSWORD,
  ensureLiveProxyHealthy,
  registerUserViaUi,
  uniqueEmail,
} from '../auth/helpers';

test.describe('Project CRUD & Integer Version CAS Lifecycle', () => {
  test.beforeEach(async ({ request }) => {
    await ensureLiveProxyHealthy(request);
  });

  test('creates, edits with integer version CAS, persists across reload, and deletes a project', async ({
    page,
  }) => {
    const email = uniqueEmail('e2e-project');
    const initialName = `清河张氏-${Date.now()}`;
    const updatedName = `${initialName}-修订`;

    await registerUserViaUi(page, { email, password: DEFAULT_E2E_PASSWORD });

    await page.goto('/projects');
    await expect(page.getByRole('heading', { name: '家族', level: 1 })).toBeVisible();

    await page.getByRole('button', { name: '新建家族' }).first().click();
    await page.locator('#familyNameInput').fill(initialName);
    await page.locator('#familySurnameInput').fill('张');
    await page.locator('#familyAncestorInput').fill('张公');
    await page.getByRole('button', { name: '确认' }).click();

    const card = page.locator(`article[data-family-name="${initialName}"]`);
    await expect(card).toBeVisible({ timeout: 15_000 });

    await card.getByRole('button', { name: '修改家族' }).click();
    await page.locator('#familyNameInput').fill(updatedName);
    await page.locator('#familyAncestorInput').fill('张公');

    const patchRequestPromise = page.waitForRequest(
      (req) =>
        req.method() === 'PATCH' && /\/api\/v1\/projects\/[^/]+$/.test(req.url()),
    );
    const patchResponsePromise = page.waitForResponse(
      (res) =>
        res.request().method() === 'PATCH' &&
        /\/api\/v1\/projects\/[^/]+$/.test(res.url()),
    );

    await page.getByRole('button', { name: '确认' }).click();

    const patchRequest = await patchRequestPromise;
    const sentBody = patchRequest.postDataJSON() as Record<string, unknown>;
    expect(sentBody.version).toBe(1);
    expect(sentBody).not.toHaveProperty('expectedUpdatedAt');

    const patchResponse = await patchResponsePromise;
    expect(patchResponse.status()).toBe(200);
    const patchJson = (await patchResponse.json()) as {
      ok: boolean;
      data?: { project?: { name?: string; version?: number } };
    };
    expect(patchJson.ok).toBe(true);
    expect(patchJson.data?.project?.version).toBe(2);
    expect(patchJson.data?.project?.name).toBe(updatedName);

    const updatedCard = page.locator(`article[data-family-name="${updatedName}"]`);
    await expect(updatedCard).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(updatedCard).toBeVisible({ timeout: 15_000 });

    await updatedCard.getByRole('button', { name: '删除家族' }).click();
    await page.getByRole('button', { name: '删除', exact: true }).click();
    await expect(updatedCard).toHaveCount(0, { timeout: 15_000 });
  });
});
