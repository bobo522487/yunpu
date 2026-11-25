import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, test, vi } from "vitest";

const getSessionMock = vi.hoisted(() => vi.fn());

vi.mock("../../apps/api/src/modules/auth", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../apps/api/src/modules/auth")>();
  return { ...actual, getSession: getSessionMock };
});

import { request } from "../auth/fixtures";

describe("auth middleware scope", () => {
  beforeEach(() => getSessionMock.mockClear());

  test("/api/health never touches the auth session", async () => {
    const response = await request("/api/health");
    expect(response.status).toBe(200);
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  test("non-API routes never touch the auth session", async () => {
    const response = await request("/");
    expect(response.status).toBe(404);
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  test("the media capability exception is gone", async () => {
    const source = await readFile("apps/api/src/middleware/auth.ts", "utf8");
    expect(source).not.toContain("MEDIA_PREFIX");
    expect(source).not.toContain("isMediaRequest");
  });
});
