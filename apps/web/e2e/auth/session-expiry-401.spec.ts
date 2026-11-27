import { expect, test } from '@playwright/test';
import {
  DEFAULT_E2E_PASSWORD,
  ensureLiveProxyHealthy,
  loginUserViaUi,
  registerUserViaUi,
  uniqueEmail,
} from './helpers';

test.describe('Session Expiry (401 Recovery)', () => {
  test.beforeEach(async ({ request }) => {
    await ensureLiveProxyHealthy(request);
  });

  test('redirects to /login with expiry banner when session cookie is cleared and live API returns 401', async ({
    context,
    page,
  }) => {
    const email = uniqueEmail('e2e-401');
    await registerUserViaUi(page, { email, password: DEFAULT_E2E_PASSWORD });
    await expect(page.getByRole('heading', { name: /你好，/ })).toBeVisible();

    // Clear session cookies in the active context to simulate expired/invalidated session on the live backend
    await context.clearCookies();

    // Trigger an authenticated API request by navigating to Members inside the SPA
    await page.getByRole('link', { name: '成员' }).click();

    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(
      page.getByText('登录状态已失效或浏览器未保存会话 Cookie，请重新登录'),
    ).toBeVisible({ timeout: 15_000 });

    // Re-authenticating recovers cleanly
    await loginUserViaUi(page, { email, password: DEFAULT_E2E_PASSWORD });
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
    await expect(page.getByTestId('nc-sidebar-userinfo')).toBeVisible();
  });
});
