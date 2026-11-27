import type { ErrorCode } from '@yunpu/shared';

export type ClientErrorCode = ErrorCode | 'UNREACHABLE' | 'INVALID_RESPONSE';

export class ApiError extends Error {
  code: ClientErrorCode | (string & {});
  status: number;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    code: ClientErrorCode | (string & {}),
    status: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type ApiEnvelope<T> =
  | { ok: true; data?: T }
  | { ok: false; code: string; message: string; details?: Record<string, unknown> };

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
};

export type MockHandler = (path: string, options: RequestOptions) => unknown;

let mockMode = false;
let directMock = false;
let mockHandler: MockHandler | null = null;
let authEpoch = 0;
const listeners = new Set<() => void>();

export function isMockMode(): boolean {
  return mockMode;
}

export function subscribeMockMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function registerMockHandler(
  handler: MockHandler,
  options?: { direct?: boolean },
): void {
  mockHandler = handler;
  directMock = Boolean(options?.direct);
}

export function resetApiTransportForTests(): void {
  mockMode = false;
  directMock = false;
  mockHandler = null;
  authEpoch = 0;
}

function isAuthEstablishPath(path: string): boolean {
  return (
    path.startsWith('/api/v1/auth/sign-in') ||
    path.startsWith('/api/v1/auth/sign-up')
  );
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
  const requestEpoch = authEpoch;

  if (directMock && mockHandler) {
    setMockMode(true);
    try {
      const result = mockHandler(path, options) as T;
      if (isAuthEstablishPath(path)) {
        authEpoch += 1;
      }
      return result;
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 401 &&
        !path.startsWith('/api/v1/auth/sign-in') &&
        requestEpoch === authEpoch
      ) {
        notifyUnauthorized();
      }
      throw error;
    }
  }

  const headers: Record<string, string> = { ...options.headers };
  let body: BodyInit | undefined;

  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let payload: ApiEnvelope<T> | null;

  try {
    const response = await fetch(path, {
      method: options.method ?? 'GET',
      headers,
      body,
      credentials: 'include',
      // 连接挂起（后端半死、代理无响应）时也要 reject，
      // 超时必须 reject，调用方才能进入错误态。
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
      if (isAuthEstablishPath(path)) {
        authEpoch += 1;
      }
      return payload.data as T;
    }

    throw new ApiError('API 不可达', 'UNREACHABLE', 0);
  } catch (error) {
    if (error instanceof ApiError && error.code !== 'UNREACHABLE') {
      if (
        error.status === 401 &&
        !path.startsWith('/api/v1/auth/sign-in') &&
        requestEpoch === authEpoch
      ) {
        notifyUnauthorized();
      }
      throw error;
    }
    throw new ApiError('API 不可达', 'UNREACHABLE', 0);
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return '请求失败，请稍后重试';
}
