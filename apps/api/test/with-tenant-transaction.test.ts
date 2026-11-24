import { afterEach, describe, expect, test, vi } from "vitest";
import {
  RETRYABLE_ERROR_CODES,
  businessPool,
  isNonRetryableConflictError,
  isRetryableTenantError,
  withTenantTransaction,
} from "../src/db/with-tenant-transaction";

function codedError(code: string, message = code): Error & { code: string } {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
}

describe("withTenantTransaction retry classification", () => {
  test("RETRYABLE_ERROR_CODES covers connection reset and serialization deadlocks", () => {
    expect([...RETRYABLE_ERROR_CODES].sort()).toEqual(
      ["40001", "40P01", "ECONNRESET"].sort(),
    );
  });

  test("isRetryableTenantError accepts listed codes and ECONNRESET messages", () => {
    for (const code of RETRYABLE_ERROR_CODES) {
      expect(isRetryableTenantError(codedError(code))).toBe(true);
    }
    expect(isRetryableTenantError(new Error("read ECONNRESET"))).toBe(true);
    expect(isRetryableTenantError(codedError("23505"))).toBe(false);
    expect(isRetryableTenantError(codedError("22P02"))).toBe(false);
    expect(isRetryableTenantError(new Error("plain failure"))).toBe(false);
  });

  test("isNonRetryableConflictError only matches unique violations (23505)", () => {
    expect(isNonRetryableConflictError(codedError("23505"))).toBe(true);
    expect(isNonRetryableConflictError(codedError("40001"))).toBe(false);
    expect(isNonRetryableConflictError(new Error("no code"))).toBe(false);
  });
});

describe("withTenantTransaction retry behavior (mocked pool)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockClient(queryImpl?: (sql: string) => Promise<unknown>) {
    const release = vi.fn();
    const query = vi.fn(async (sql: string) => {
      if (queryImpl) return queryImpl(sql);
      if (sql === "SELECT current_user") {
        return { rows: [{ current_user: "genealogy_app" }] };
      }
      return { rows: [] };
    });
    return { query, release };
  }

  test("retries ECONNRESET from connect up to 3 attempts then succeeds", async () => {
    let connects = 0;
    const client = mockClient();
    vi.spyOn(businessPool, "connect").mockImplementation(async () => {
      connects += 1;
      if (connects < 3) {
        throw codedError("ECONNRESET", "Connection reset");
      }
      return client as never;
    });

    const result = await withTenantTransaction(
      { userId: "00000000-0000-7000-8000-000000000001", orgId: "00000000-0000-7000-8000-000000000002" },
      async () => "ok",
    );

    expect(result).toBe("ok");
    expect(connects).toBe(3);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test("does not retry unique violation 23505", async () => {
    let connects = 0;
    const client = mockClient();
    vi.spyOn(businessPool, "connect").mockImplementation(async () => {
      connects += 1;
      return client as never;
    });

    await expect(
      withTenantTransaction({ userId: "u" }, async () => {
        throw codedError("23505", "duplicate key");
      }),
    ).rejects.toMatchObject({ code: "23505" });

    expect(connects).toBe(1);
  });

  test("gives up after 3 retryable failures", async () => {
    let connects = 0;
    vi.spyOn(businessPool, "connect").mockImplementation(async () => {
      connects += 1;
      throw codedError("40001", "serialization_failure");
    });

    await expect(
      withTenantTransaction({ userId: "u" }, async () => "never"),
    ).rejects.toMatchObject({ code: "40001" });

    expect(connects).toBe(3);
  });
});
