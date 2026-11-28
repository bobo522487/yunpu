import { describe, expect, test } from "vitest";
import app from "../src/app";
import { getBoundContractOperations } from "../src/lib/contract";
import {
  CONTRACT_OPERATIONS,
  OPENAPI_OPERATIONS,
} from "../src/openapi/operations";

const MOUNTS = new Map<string, string>([
  ["apps/api/src/app.ts", ""],
  ["apps/api/src/media.ts", ""],
  ["apps/api/src/modules/auth/router.ts", "/api/v1/auth"],
  ["apps/api/src/modules/account/router.ts", "/api/v1"],
  ["apps/api/src/modules/organization/router.ts", "/api/v1"],
  ["apps/api/src/modules/project/router.ts", "/api/v1"],
  ["apps/api/src/modules/folder/router.ts", "/api/v1"],
  ["apps/api/src/modules/lineage/router.ts", "/api/v1"],
  ["apps/api/src/modules/person/router.ts", "/api/v1"],
  ["apps/api/src/modules/article/router.ts", "/api/v1"],
  ["apps/api/src/modules/book/router.ts", "/api/v1"],
]);

function expectedFullRoute(
  operation: (typeof OPENAPI_OPERATIONS)[number],
): string {
  if (operation.route.startsWith("/api/")) return operation.route;
  const prefix = MOUNTS.get(operation.source) ?? "";
  return `${prefix}${operation.route.startsWith("/") ? operation.route : `/${operation.route}`}`;
}

describe("contract同源绑定一致性和鉴权顺序", () => {
  test("每条 CONTRACT_OPERATIONS 均在运行期完成同实例绑定且已挂载到 app", () => {
    const bound = getBoundContractOperations();
    expect(bound.size).toBe(CONTRACT_OPERATIONS.length);

    for (const op of CONTRACT_OPERATIONS) {
      expect(
        bound.has(op),
        `未在运行期绑定的契约操作: ${op.source} ${op.method} ${op.route}`,
      ).toBe(true);
    }

    const appRouteKeys = new Set(
      app.routes.map((r) => `${r.method.toLowerCase()}:${r.path}`),
    );
    for (const op of OPENAPI_OPERATIONS) {
      const fullKey = `${op.method}:${expectedFullRoute(op)}`;
      expect(
        appRouteKeys.has(fullKey),
        `Hono app.routes 缺少路由: ${fullKey}`,
      ).toBe(true);
    }
  });

  test("受保护契约路由在参数不合法时仍先执行认证守卫返回 401", async () => {
    const res = await app.request("/api/v1/projects/not-a-uuid/folders");
    expect(res.status).toBe(401);
  });
});
