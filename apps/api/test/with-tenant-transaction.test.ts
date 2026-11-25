import { afterEach, describe, expect, test, vi } from "vitest";
import {
  RETRYABLE_ERROR_CODES,
  businessPool,
  isNonRetryableConflictError,
  isRetryableTenantError,
  withTenantTransaction,
} from "../src/db/with-tenant-transaction";

const START_SQL = "BEGIN; SET LOCAL ROLE genealogy_app";
const CONTEXT_SQL =
  "SELECT set_config('app.user_id', $1, true), current_user AS role";

function codedError(code: string, message = code): Error & { code: string } {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
}

function mockClient(
  queryImpl?: (sql: string) => Promise<unknown> | unknown,
): { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> } {
  const release = vi.fn();
  const query = vi.fn(async (sql: string) => {
    if (queryImpl) return queryImpl(sql);
    if (sql === CONTEXT_SQL) return { rows: [{ role: "genealogy_app" }] };
    return { rows: [] };
  });
  return { query, release };
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

    const result = await withTenantTransaction({ userId: "u" }, async () => "ok");

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

describe("withTenantTransaction session setup and pool hygiene", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("uses two startup round trips and never writes app.current_org_id", async () => {
    const client = mockClient();
    vi.spyOn(businessPool, "connect").mockResolvedValue(client as never);

    await withTenantTransaction({ userId: "u" }, async () => "ok");

    expect(client.query.mock.calls.map((call: unknown[]) => call[0])).toEqual([
      START_SQL,
      CONTEXT_SQL,
      "COMMIT",
    ]);
    expect(client.query.mock.calls[1][1]).toEqual(["u"]);
    expect(client.release).toHaveBeenCalledWith(false);
  });

  test("destroys the connection when ROLLBACK itself fails", async () => {
    const client = mockClient((sql) => {
      if (sql === "ROLLBACK") throw new Error("rollback transport failure");
      if (sql === CONTEXT_SQL) return { rows: [{ role: "genealogy_app" }] };
      return { rows: [] };
    });
    vi.spyOn(businessPool, "connect").mockResolvedValue(client as never);

    await expect(
      withTenantTransaction({ userId: "u" }, async () => {
        throw new Error("business failure");
      }),
    ).rejects.toThrow("business failure");

    expect(client.release).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith(true);
  });

  test("destroys the connection after a connection-level failure", async () => {
    const client = mockClient();
    vi.spyOn(businessPool, "connect").mockResolvedValue(client as never);

    await expect(
      withTenantTransaction({ userId: "u" }, async () => {
        throw codedError("57P01", "terminated by administrative command");
      }),
    ).rejects.toMatchObject({ code: "57P01" });

    expect(client.release).toHaveBeenCalledWith(true);
  });

  test("destroys the connection when the genealogy_app role assertion fails", async () => {
    const client = mockClient((sql) => {
      if (sql === CONTEXT_SQL) return { rows: [{ role: "somebody_else" }] };
      return { rows: [] };
    });
    vi.spyOn(businessPool, "connect").mockResolvedValue(client as never);

    await expect(
      withTenantTransaction({ userId: "u" }, async () => "ok"),
    ).rejects.toThrow("database role assertion failed: expected genealogy_app");

    expect(client.release).toHaveBeenCalledWith(true);
  });

  test("reuses a healthy connection after an ordinary business error", async () => {
    const client = mockClient();
    vi.spyOn(businessPool, "connect").mockResolvedValue(client as never);

    await expect(
      withTenantTransaction({ userId: "u" }, async () => {
        throw codedError("GX001", "cycle");
      }),
    ).rejects.toMatchObject({ code: "GX001" });

    expect(client.query.mock.calls.map((call: unknown[]) => call[0])).toContain(
      "ROLLBACK",
    );
    expect(client.release).toHaveBeenCalledWith(false);
  });
});
