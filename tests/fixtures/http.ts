import { type JsonResponse, request } from "../auth/fixtures";

export type Envelope = {
  status: number;
  json: JsonResponse;
  data?: Record<string, unknown>;
};

export async function call(
  path: string,
  cookie: string | null,
  init: RequestInit = {},
): Promise<Envelope> {
  const response = await request(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...(init.headers ?? {}),
    },
  });
  const json = (await response.json()) as JsonResponse;
  return { status: response.status, json, data: json.data };
}
