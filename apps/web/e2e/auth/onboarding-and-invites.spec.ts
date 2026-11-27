import { expect, test } from '@playwright/test';
import {
  DEFAULT_E2E_PASSWORD,
  ensureLiveProxyHealthy,
  registerUserViaUi,
  uniqueEmail,
} from './helpers';

test.describe('Onboarding & Organization Invitations', () => {
  test.beforeEach(async ({ request }) => {
    await ensureLiveProxyHealthy(request);
  });

  test('creates an invite as org owner, validates invalid tokens, redeems valid invite, and creates org via onboarding', async ({
    browser,
    page,
  }) => {
    const ownerEmail = uniqueEmail('e2e-owner');
    const inviteeEmail = uniqueEmail('e2e-invitee');

    // 1. Owner registers and navigates to /members to create an invite for inviteeEmail
    await registerUserViaUi(page, { email: ownerEmail, password: DEFAULT_E2E_PASSWORD });
    const ownerWorkspaceName = (
      await page.getByTestId('nc-ws-sidebar-selector').innerText()
    ).trim();

    await page.goto('/members');
    const inviteButton = page.getByRole('button', { name: '邀请成员' });
    await expect(inviteButton).toBeVisible({ timeout: 15_000 });
    await inviteButton.click();

    await page.locator('#invite-email').fill(inviteeEmail);
    await page.getByRole('button', { name: '创建邀请链接' }).click();

    await expect(page.getByText('邀请链接已生成')).toBeVisible({ timeout: 15_000 });
    const inviteUrlValue = await page
      .getByRole('textbox', { name: '邀请链接' })
      .inputValue();
    const tokenMatch = inviteUrlValue.match(/\/invite\/([^/?#]+)/);
    expect(tokenMatch?.[1], `Expected /invite/<token> in ${inviteUrlValue}`).toBeTruthy();
    const inviteToken = tokenMatch![1];
    const invitePath = `/invite/${inviteToken}`;

    await page.getByRole('button', { name: '关闭' }).first().click();

    // 2. Invitee registers in an isolated browser context
    const inviteeContext = await browser.newContext();
    const inviteePage = await inviteeContext.newPage();
    try {
      await registerUserViaUi(inviteePage, {
        email: inviteeEmail,
        password: DEFAULT_E2E_PASSWORD,
      });

      // 3. Invalid invite token shows error banner on /onboarding
      await inviteePage.goto('/onboarding?invite=invalid-e2e-token-000');
      await expect(inviteePage.locator('#inviteToken')).toHaveValue('invalid-e2e-token-000');
      await inviteePage.getByRole('button', { name: '接受邀请' }).click();
      await expect(inviteePage.locator('.text-destructive').first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(inviteePage).toHaveURL(/\/onboarding/);

      // 4. Navigating to /invite/<token> redirects to /onboarding?invite=<token> and prefills token
      await inviteePage.goto(invitePath);
      await expect(inviteePage).toHaveURL(new RegExp(`/onboarding\\?invite=${inviteToken}`));
      await expect(inviteePage.locator('#inviteToken')).toHaveValue(inviteToken);

      await inviteePage.getByRole('button', { name: '接受邀请' }).click();
      await expect(inviteePage).toHaveURL(/\/home/, { timeout: 20_000 });

      // Active workspace switched to owner's organization
      await expect(inviteePage.getByTestId('nc-ws-sidebar-selector')).toContainText(
        ownerWorkspaceName,
        { timeout: 15_000 },
      );

      // 5. Onboarding page also supports creating a new organization
      const newOrgName = `e2e宗亲空间-${Date.now()}`;
      await inviteePage.goto('/onboarding?invite=create-org-check');
      await inviteePage.locator('#organizationName').fill(newOrgName);
      await inviteePage.getByRole('button', { name: '创建并进入工作区' }).click();

      await expect(inviteePage).toHaveURL(/\/home/, { timeout: 20_000 });
      await expect(inviteePage.getByTestId('nc-ws-sidebar-selector')).toContainText(
        newOrgName,
        { timeout: 15_000 },
      );
    } finally {
      await inviteeContext.close();
    }
  });
});
