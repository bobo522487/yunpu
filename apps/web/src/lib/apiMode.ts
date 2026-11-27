export type ApiModeEnv = {
  VITE_API_PROXY_TARGET?: string;
  [key: string]: unknown;
};

export function resolveProxyTarget(
  processEnv?: ApiModeEnv | null,
  fileEnv?: ApiModeEnv | null,
): string | undefined {
  const fromProcess = processEnv?.VITE_API_PROXY_TARGET?.trim();
  if (fromProcess) return fromProcess;
  const fromFile = fileEnv?.VITE_API_PROXY_TARGET?.trim();
  return fromFile || undefined;
}

export function isHttpsProxyRequest(headers: {
  'x-forwarded-proto'?: string | string[];
  origin?: string;
  referer?: string;
}): boolean {
  const xfProto = headers['x-forwarded-proto'];
  const proto = Array.isArray(xfProto) ? xfProto[0] : xfProto;
  if (proto?.split(',')[0]?.trim().toLowerCase() === 'https') return true;
  if (headers.origin?.startsWith('https://')) return true;
  if (headers.referer?.startsWith('https://')) return true;
  return false;
}

export function rewriteProxySetCookie(
  cookies: string | string[] | undefined,
  isHttps: boolean,
): string[] | undefined {
  if (!cookies) return undefined;
  const list = Array.isArray(cookies) ? cookies : [cookies];
  return list.map((cookie) => {
    let next = cookie.replace(/;\s*Domain=[^;]*/gi, '');
    if (isHttps) {
      if (/;\s*SameSite=/i.test(next)) {
        next = next.replace(/;\s*SameSite=[^;]*/gi, '; SameSite=None');
      } else {
        next += '; SameSite=None';
      }
      if (!/;\s*Secure\b/i.test(next)) {
        next += '; Secure';
      }
      if (!/;\s*Partitioned\b/i.test(next)) {
        next += '; Partitioned';
      }
    }
    return next;
  });
}

export function buildApiProxyConfig(target?: string) {
  const trimmed = target?.trim();
  if (!trimmed) return undefined;
  return {
    '/api': {
      target: trimmed,
      changeOrigin: true,
      cookieDomainRewrite: '',
      configure: (proxy: {
        on: (
          event: 'proxyRes',
          handler: (
            proxyRes: { headers: Record<string, string | string[] | undefined> },
            req: {
              headers: {
                'x-forwarded-proto'?: string | string[];
                origin?: string;
                referer?: string;
              };
            },
          ) => void,
        ) => void;
      }) => {
        proxy.on('proxyRes', (proxyRes, req) => {
          const rewritten = rewriteProxySetCookie(
            proxyRes.headers['set-cookie'],
            isHttpsProxyRequest(req.headers),
          );
          if (rewritten) {
            proxyRes.headers['set-cookie'] = rewritten;
          }
        });
      },
    },
  };
}
