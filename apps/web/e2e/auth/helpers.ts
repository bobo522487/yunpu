import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const DEFAULT_E2E_PASSWORD =
  process.env.E2E_AUTH_PASSWORD || 'YunpuTest123!';

export function uniqueEmail(prefix = 'e2e-auth'): string {
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${Date.now()}-${rand}@example.com`;
}

export async function ensureLiveProxyHealthy(
  request: APIRequestContext,
): Promise<void> {
  const response = await request.get('/api/v1/auth/session');
  expect(
    response.status(),
    `Expected /api/v1/auth/session proxy to return 200, got ${response.status()}`,
  ).toBe(200);
  const json = (await response.json()) as { ok?: boolean };
  expect(json.ok, 'Expected JSON envelope { ok: true } from live API proxy').toBe(
    true,
  );
}

export async function registerUserViaUi(
  page: Page,
  options: { email: string; password?: string; inviteToken?: string },
): Promise<void> {
  const password = options.password ?? DEFAULT_E2E_PASSWORD;
  const target = options.inviteToken
    ? `/register?invite=${encodeURIComponent(options.inviteToken)}`
    : '/register';
  await page.goto(target);
  await page.locator('#email').fill(options.email);
  await page.locator('#password').fill(password);
  if (options.inviteToken) {
    await expect(page.locator('#inviteToken')).toHaveValue(options.inviteToken);
  }
  await page.getByRole('button', { name: '注册并进入工作区' }).click();
  await expect(page).toHaveURL(/\/home/, { timeout: 20_000 });
  await expect(page.getByTestId('nc-sidebar-userinfo')).toBeVisible();
}

export async function loginUserViaUi(
  page: Page,
  options: { email: string; password?: string },
): Promise<void> {
  const password = options.password ?? DEFAULT_E2E_PASSWORD;
  await page.locator('#email').fill(options.email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: '登录工作区' }).click();
}

export async function logoutViaUi(page: Page): Promise<void> {
  await page.getByTestId('nc-sidebar-userinfo').click();
  await page.getByRole('menuitem', { name: '退出登录' }).click();
  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
}
