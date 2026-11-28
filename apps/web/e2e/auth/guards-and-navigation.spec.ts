import { expect, test } from '@playwright/test';
import {
  DEFAULT_E2E_PASSWORD,
  ensureLiveProxyHealthy,
  loginUserViaUi,
  logoutViaUi,
  registerUserViaUi,
  uniqueEmail,
} from './helpers';

test.describe('Auth Route Guards & Public Navigation', () => {
  test.beforeEach(async ({ request }) => {
    await ensureLiveProxyHealthy(request);
  });

  test('redirects anonymous users from protected routes to /login with redirect query', async ({
    page,
  }) => {
    for (const protectedPath of ['/home', '/members', '/settings', '/onboarding']) {
      await page.goto(protectedPath);
      await expect(page).toHaveURL(/\/login\?redirect=/);
      const url = new URL(page.url());
      expect(url.pathname).toBe('/login');
      expect(url.searchParams.get('redirect')).toBe(protectedPath);
    }
  });

  test('redirects anonymous /invite/:token visits through /onboarding to /login', async ({
    page,
  }) => {
    await page.goto('/invite/sample-token-xyz');
    await expect(page).toHaveURL(/\/login\?redirect=/);
    const url = new URL(page.url());
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('redirect')).toContain('/onboarding?invite=sample-token-xyz');
  });

  test('navigates between login, register, and forgot-password pages', async ({
    page,
  }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();

    await page.getByRole('link', { name: '忘记密码？' }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.getByRole('heading', { name: '重置密码' })).toBeVisible();
    await expect(page.getByText('请联系你的组织管理员重置密码')).toBeVisible();

    await page.getByRole('link', { name: '返回登录' }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.getByRole('link', { name: '立即注册' }).click();
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByRole('heading', { name: '创建账号' })).toBeVisible();

    await page.getByRole('link', { name: '直接登录' }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('ignores unsafe external or protocol-relative redirect parameters after login', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('e2e-redirect');
    await registerUserViaUi(page, { email, password: DEFAULT_E2E_PASSWORD });
    await logoutViaUi(page);

    await page.goto('/login?redirect=//evil.example.com/phish');
    await loginUserViaUi(page, { email, password: DEFAULT_E2E_PASSWORD });

    await expect(page).toHaveURL(/\/projects/, { timeout: 20_000 });
    expect(new URL(page.url()).host).toBe(
      new URL(baseURL ?? 'http://127.0.0.1:3000').host,
    );
  });
});
