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

let authEpoch = 0;

export function resetApiTransportForTests(): void {
  authEpoch = 0;
}

function isAuthEstablishPath(path: string): boolean {
  return (
    path.startsWith('/api/v1/auth/sign-in') ||
    path.startsWith('/api/v1/auth/sign-up')
  );
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

async function performEnvelopeFetch<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const requestEpoch = authEpoch;
  let payload: ApiEnvelope<T> | null;

  try {
    const response = await fetch(path, init);

    try {
      payload = (await response.json()) as ApiEnvelope<T>;
    } catch {
      payload = null;
    }

    if (isEnvelope(payload)) {
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

  return performEnvelopeFetch<T>(path, {
    method: options.method ?? 'GET',
    headers,
    body,
    credentials: 'include',
    signal: AbortSignal.timeout(10_000),
  });
}

export async function apiUpload<T>(
  path: string,
  blob: Blob,
  contentType: string,
): Promise<T> {
  return performEnvelopeFetch<T>(path, {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: blob,
    credentials: 'include',
    signal: AbortSignal.timeout(30_000),
  });
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return '请求失败，请稍后重试';
}
