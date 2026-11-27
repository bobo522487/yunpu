/// <reference types="vitest/config" />
import { existsSync, readdirSync } from 'node:fs'
import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { playwright } from '@vitest/browser-playwright'
import { buildApiProxyConfig, resolveProxyTarget } from './src/lib/apiMode'

function resolveChromiumExecutable() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  }

  const cacheRoot = path.join(process.env.HOME ?? '', '.cache/ms-playwright')
  if (!existsSync(cacheRoot)) return undefined

  const chromiumDir = readdirSync(cacheRoot)
    .filter((entry) => /^chromium-\d+$/.test(entry))
    .sort((a, b) => Number(b.slice(9)) - Number(a.slice(9)))[0]
  if (!chromiumDir) return undefined

  const executable = path.join(cacheRoot, chromiumDir, 'chrome-linux64/chrome')
  return existsSync(executable) ? executable : undefined
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = resolveProxyTarget(process.env, fileEnv)
  const proxy = buildApiProxyConfig(apiProxyTarget)
  const browserExecutablePath = resolveChromiumExecutable()
  const browserEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key !== 'LD_LIBRARY_PATH')
  )
  const chromiumLaunchOptions = browserExecutablePath
    ? { executablePath: browserExecutablePath, env: browserEnv }
    : undefined

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      ...(proxy ? { proxy } : {}),
    },
    plugins: [
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
      }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      silent: 'passed-only',
      unstubEnvs: true,
      include: [
        'src/components/**/*.test.{ts,tsx}',
        'src/context/**/*.test.{ts,tsx}',
      ],
      browser: {
        enabled: true,
        provider: playwright(
          chromiumLaunchOptions
            ? { launchOptions: chromiumLaunchOptions }
            : {}
        ),
        instances: [{ browser: 'chromium' }],
      },
      coverage: {
        exclude: [
          'src/components/ui/**',
          'src/assets/**',
          'src/routeTree.gen.ts',
          'src/test-utils/**',
          'src/routes/**',
        ],
      },
    },
  }
})
