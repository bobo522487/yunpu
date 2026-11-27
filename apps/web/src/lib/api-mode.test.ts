import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  buildApiProxyConfig,
  isHttpsProxyRequest,
  resolveProxyTarget,
  rewriteProxySetCookie,
} from './apiMode.ts';

test('resolveProxyTarget 优先读取 processEnv，并支持 .env.local 兜底', () => {
  assert.equal(
    resolveProxyTarget(
      { VITE_API_PROXY_TARGET: 'https://secret.example.com' },
      { VITE_API_PROXY_TARGET: 'https://yunpu-dev.t-plus.com.cn' },
    ),
    'https://secret.example.com',
  );
  assert.equal(
    resolveProxyTarget(
      { VITE_API_PROXY_TARGET: '  ' },
      { VITE_API_PROXY_TARGET: 'https://yunpu-dev.t-plus.com.cn' },
    ),
    'https://yunpu-dev.t-plus.com.cn',
  );
  assert.equal(resolveProxyTarget({}, {}), undefined);
});

test('buildApiProxyConfig 生成同源 /api 代理与 cookie 域名剥离配置', () => {
  assert.equal(buildApiProxyConfig(undefined), undefined);
  const config = buildApiProxyConfig('https://yunpu-dev.t-plus.com.cn');
  assert.ok(config);
  assert.equal(config['/api'].target, 'https://yunpu-dev.t-plus.com.cn');
  assert.equal(config['/api'].changeOrigin, true);
  assert.equal(config['/api'].cookieDomainRewrite, '');
  assert.equal(typeof config['/api'].configure, 'function');
});

test('isHttpsProxyRequest 识别 HTTPS 预览上下文与本地 HTTP', () => {
  assert.equal(isHttpsProxyRequest({ 'x-forwarded-proto': 'https' }), true);
  assert.equal(
    isHttpsProxyRequest({ origin: 'https://ais-dev-demo.run.app' }),
    true,
  );
  assert.equal(
    isHttpsProxyRequest({ referer: 'https://ais-dev-demo.run.app/login' }),
    true,
  );
  assert.equal(
    isHttpsProxyRequest({
      'x-forwarded-proto': 'http',
      origin: 'http://localhost:3000',
    }),
    false,
  );
});

test('rewriteProxySetCookie 在 HTTPS 下升级 SameSite=None; Secure; Partitioned 以兼容预览 iframe', () => {
  const raw = [
    'better-auth.session_token=abc; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax; Domain=yunpu-dev.t-plus.com.cn',
  ];
  assert.deepEqual(rewriteProxySetCookie(raw, true), [
    'better-auth.session_token=abc; Max-Age=604800; Path=/; HttpOnly; SameSite=None; Secure; Partitioned',
  ]);
  assert.deepEqual(rewriteProxySetCookie(raw, false), [
    'better-auth.session_token=abc; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax',
  ]);
});
