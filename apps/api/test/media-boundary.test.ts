import { expect, spyOn, test } from "bun:test";
import app from "../src/app";
import { config } from "../src/config";
import { isAllowedMediaKey } from "../src/media";
import * as storage from "../src/storage";

const bearer = { authorization: `Bearer ${config().YUNPU_CAPABILITY_TOKEN}` };
const validKey = "media/20261115T1023/" + "a".repeat(32);

test("only randomKey-shaped keys are accepted", () => {
  expect(isAllowedMediaKey(validKey)).toBe(true);
  for (const bad of ["../etc/passwd", "media/../../secret", "media/x/y",
                     "media/20261115T1023/" + "A".repeat(32), "..%2f..%2fsecret"]) {
    expect(isAllowedMediaKey(bad)).toBe(false);
  }
});

test("path traversal never reaches storage", async () => {
  const r = await app.request("/api/media/..%2f..%2fsecret", { headers: bearer });
  expect(r.status).toBe(400);
});

test("oversize content-length is rejected before arrayBuffer", async () => {
  const r = await app.request("/api/media", {
    method: "POST",
    headers: { ...bearer, "content-length": "2000000" },
    body: "x",
  });
  expect(r.status).toBe(413);
});

test("media capability-token auth survives the shared middleware chain", async () => {
  // Task 3 之后 getObject 在 storage 未初始化时会抛 storage not initialized；
  // app.request 单测不走 index.ts 的 initStorage，故注入 getObject 只验证路由/鉴权边界。
  const spy = spyOn(storage, "getObject").mockResolvedValue(undefined);
  try {
    const noToken = await app.request("/api/media/" + validKey);
    expect(noToken.status).toBe(401);
    const withToken = await app.request("/api/media/" + validKey, { headers: bearer });
    expect(withToken.status).toBe(404);
    expect((await withToken.json() as { reason?: string }).reason).toBe("object not found");
  } finally { spy.mockRestore(); }
});
