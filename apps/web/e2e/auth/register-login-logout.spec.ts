import { expect, test } from '@playwright/test';
import {
  DEFAULT_E2E_PASSWORD,
  ensureLiveProxyHealthy,
  loginUserViaUi,
  logoutViaUi,
  registerUserViaUi,
  uniqueEmail,
} from './helpers';

test.describe('Auth Register, Login, Redirect & Logout Lifecycle', () => {
  test.beforeEach(async ({ request }) => {
    await ensureLiveProxyHealthy(request);
  });

  test('enforces minimum password length on registration form', async ({ page }) => {
    await page.goto('/register');
    await page.locator('#email').fill(uniqueEmail('e2e-short-pw'));
    await page.locator('#password').fill('short');
    await page.getByRole('button', { name: '注册并进入工作区' }).click();

    await expect(page).toHaveURL(/\/register/);
    const tooShort = await page
      .locator('#password')
      .evaluate((el) => (el as HTMLInputElement).validity.tooShort);
    expect(tooShort).toBe(true);
  });

  test('registers a user, enforces authenticated guards, rejects duplicate email, and handles login/logout', async ({
    browser,
    page,
  }) => {
    const email = uniqueEmail('e2e-lifecycle');

    // 1. Sign up new account against live backend
    await registerUserViaUi(page, { email, password: DEFAULT_E2E_PASSWORD });
    await expect(page.getByText(email)).toBeVisible();

    // 2. Authenticated user visiting /login, /register, or /onboarding (no invite) redirects to /home
    for (const authPath of ['/login', '/register', '/onboarding']) {
      await page.goto(authPath);
      await expect(page).toHaveURL(/\/home/);
    }

    // 3. Duplicate registration in a fresh anonymous context shows error banner
    const dupContext = await browser.newContext();
    const dupPage = await dupContext.newPage();
    try {
      await dupPage.goto('/register');
      await dupPage.locator('#email').fill(email);
      await dupPage.locator('#password').fill(DEFAULT_E2E_PASSWORD);
      await dupPage.getByRole('button', { name: '注册并进入工作区' }).click();

      await expect(dupPage).toHaveURL(/\/register/);
      await expect(dupPage.locator('form .text-destructive')).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      await dupContext.close();
    }

    // 4. Logout clears server session cookie and blocks protected routes
    await logoutViaUi(page);
    await page.goto('/members');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fmembers/);

    // 5. Invalid password shows error banner and stays on /login
    await loginUserViaUi(page, { email, password: 'WrongPassword999!' });
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('form .text-destructive')).toBeVisible({
      timeout: 15_000,
    });

    // 6. Valid login restores session and honors ?redirect=/members
    await loginUserViaUi(page, { email, password: DEFAULT_E2E_PASSWORD });
    await expect(page).toHaveURL(/\/members/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: '成员', level: 1 })).toBeVisible();
  });
});
