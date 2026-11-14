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

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
};

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

  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers,
    body,
    credentials: 'include',
  });

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload || payload.ok === false) {
    const failure = payload && payload.ok === false ? payload : null;
    throw new ApiError(
      failure?.message || `请求失败（HTTP ${response.status}）`,
      failure?.code || 'INTERNAL',
      response.status,
      failure?.details,
    );
  }

  return payload.data;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return '请求失败，请稍后重试';
}
