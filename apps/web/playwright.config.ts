import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

function resolveChromiumExecutable(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }

  const cacheRoot = path.join(process.env.HOME ?? '', '.cache/ms-playwright');
  if (!existsSync(cacheRoot)) return undefined;

  const chromiumDir = readdirSync(cacheRoot)
    .filter((entry) => /^chromium-\d+$/.test(entry))
    .sort((a, b) => Number(b.slice(9)) - Number(a.slice(9)))[0];
  if (!chromiumDir) return undefined;

  const executable = path.join(cacheRoot, chromiumDir, 'chrome-linux64/chrome');
  return existsSync(executable) ? executable : undefined;
}

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const browserExecutablePath = resolveChromiumExecutable();
const hasPlaywrightVideoFfmpeg = existsSync(
  path.join(process.env.HOME ?? '', '.cache/ms-playwright/ffmpeg-1011/ffmpeg-linux'),
);
const browserEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] =>
      entry[0] !== 'LD_LIBRARY_PATH' && typeof entry[1] === 'string',
  ),
);

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: hasPlaywrightVideoFfmpeg ? 'retain-on-failure' : 'off',
    launchOptions: browserExecutablePath
      ? { executablePath: browserExecutablePath, env: browserEnv }
      : undefined,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm run dev',
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
