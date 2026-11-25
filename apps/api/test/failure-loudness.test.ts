import { expect, test, vi } from "vitest";
import { Hono } from "hono";
import { requestId } from "hono/request-id";
import type { ApiEnv } from "../src/types";
import { auth } from "../src/modules/auth";
import { getObject } from "../src/storage";
import { onApiError, probeDatabase } from "../src/app";
import { logEvent, redact } from "../src/lib/logger";
import { signIn } from "../src/modules/auth/service";

test("uninitialised storage throws instead of returning undefined", async () => {
  await expect(getObject("media/x/y")).rejects.toThrow("storage not initialized");
});

test("unhandled errors are logged with request_id and no secrets", async () => {
  const lines: string[] = [];
  const spy = vi.spyOn(console, "log").mockImplementation((line?: unknown) => {
    lines.push(String(line));
  });
  const probe = new Hono<ApiEnv>();
  probe.use(requestId());
  probe.onError(onApiError);
  probe.get("/boom", () => { throw new Error("password=hunter2 token=abc"); });
  try {
    await probe.request("/boom");
    const log = lines.map((l) => { try { return JSON.parse(l); } catch { return {}; } })
      .find((f) => f.event === "unhandled_error");
    expect(log).toBeDefined();
    expect(log.request_id).toBeTruthy();
    expect(JSON.stringify(log)).not.toContain("hunter2");
    expect(JSON.stringify(log)).not.toContain("token=abc");
  } finally { spy.mockRestore(); }
});

test("probeDatabase uses config(), not a bare process.env read", async () => {
  const saved = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "";
  try {
    const result = await probeDatabase();
    expect(result.up).toBe(true);
  } finally {
    process.env.DATABASE_URL = saved;
  }
});

test("redact() covers quoted JSON keys, Bearer tokens and URL userinfo", () => {
  const cases: Array<{ input: string; secret: string }> = [
    { input: 'password: "hunter2"', secret: "hunter2" },
    { input: '{"token":"abc"}', secret: "abc" },
    { input: '"authorization":"Bearer abc"', secret: "abc" },
    { input: "Authorization: Bearer abc", secret: "abc" },
    { input: 'password="hunter3"', secret: "hunter3" },
    { input: "postgres://u:hunter4@127.0.0.1:5432/db", secret: "hunter4" },
    { input: "password=hunter5 token=abc6", secret: "hunter5" },
    { input: "password=hunter5 token=abc6", secret: "abc6" },
  ];
  for (const { input, secret } of cases) {
    const out = redact(input);
    expect(out).not.toContain(secret);
    expect(out).toContain("[REDACTED]");
  }
});

test("logEvent() redacts every string field, not only callers that opt in", () => {
  const lines: string[] = [];
  const spy = vi.spyOn(console, "log").mockImplementation((line?: unknown) => {
    lines.push(String(line));
  });
  try {
    logEvent({ event: "secret.probe", reason: 'password="hunter2"', stack: '{"token":"abc"}' });
    const out = lines.join("\n");
    expect(out).toContain("secret.probe");
    expect(out).not.toContain("hunter2");
    expect(out).not.toContain("abc");
    expect(out).toContain("[REDACTED]");
  } finally { spy.mockRestore(); }
});

test("a failed sign-in never logs the raw auth error", async () => {
  const lines: string[] = [];
  const consoleSpy = vi.spyOn(console, "log").mockImplementation((line?: unknown) => {
    lines.push(String(line));
  });
  const sign = vi.spyOn(auth.api, "signInEmail").mockRejectedValue(
    new Error('db down; password="hunter2" token=abc'),
  );
  try {
    await expect(
      signIn({ email: "a@example.com", password: "correct-horse" }),
    ).rejects.toThrow();
    const out = lines.join("\n");
    expect(out).toContain("auth.signed_in");
    expect(out).not.toContain("hunter2");
    expect(out).not.toContain("token=abc");
  } finally {
    sign.mockRestore();
    consoleSpy.mockRestore();
  }
});
