export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; details?: Record<string, unknown> };

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
};

export type MockHandler = (path: string, options: RequestOptions) => unknown;

let mockMode = false;
let mockHandler: MockHandler | null = null;
const listeners = new Set<() => void>();

export function isMockMode(): boolean {
  return mockMode;
}

export function subscribeMockMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function registerMockHandler(handler: MockHandler): void {
  mockHandler = handler;
}

function setMockMode(next: boolean): void {
  if (mockMode === next) return;
  mockMode = next;
  listeners.forEach((listener) => listener());
}

/** 会话失效（401）时广播，由应用层清会话并跳转登录（SC-009）。 */
function notifyUnauthorized(): void {
  window.dispatchEvent(new CustomEvent('yunpu:unauthorized'));
}

function isEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    (value.ok === true || value.ok === false)
  );
}

function toApiError(payload: ApiEnvelope<unknown>, status: number): ApiError {
  if (payload.ok === false) {
    return new ApiError(payload.message, payload.code, status, payload.details);
  }
  return new ApiError(`请求失败（HTTP ${status}）`, 'INTERNAL', status);
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { ...options.headers };
  let body: BodyInit | undefined;

  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let payload: ApiEnvelope<T> | null = null;

  try {
    const response = await fetch(path, {
      method: options.method ?? 'GET',
      headers,
      body,
      credentials: 'include',
      // 连接挂起（后端半死、代理无响应）时也要 reject，
      // 否则永远走不到 Mock 降级，页面会永久卡在加载态。
      signal: AbortSignal.timeout(10_000),
    });

    try {
      payload = (await response.json()) as ApiEnvelope<T>;
    } catch {
      payload = null;
    }

    // 只有真正的 JSON 信封才说明后端可达；HTML/代理错误等一律视为不可达。
    if (isEnvelope(payload)) {
      setMockMode(false);
      if (!response.ok || payload.ok === false) {
        throw toApiError(payload, response.status);
      }
      return payload.data;
    }

    throw new ApiError('API 不可达', 'UNREACHABLE', 0);
  } catch (error) {
    if (error instanceof ApiError && error.code !== 'UNREACHABLE') {
      if (error.status === 401) notifyUnauthorized();
      throw error;
    }
    if (mockHandler) {
      setMockMode(true);
      return mockHandler(path, options) as T;
    }
    throw new ApiError('API 不可达', 'UNREACHABLE', 0);
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return '请求失败，请稍后重试';
}
