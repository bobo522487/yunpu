import { expect, spyOn, test } from "bun:test";
import { Hono } from "hono";
import { requestId } from "hono/request-id";
import { getObject } from "../src/storage";
import { onApiError, probeDatabase } from "../src/app";

test("uninitialised storage throws instead of returning undefined", async () => {
  await expect(getObject("media/x/y")).rejects.toThrow("storage not initialized");
});

test("unhandled errors are logged with request_id and no secrets", async () => {
  const lines: string[] = [];
  const spy = spyOn(console, "log").mockImplementation((line?: unknown) => {
    lines.push(String(line));
  });
  const probe = new Hono();
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
