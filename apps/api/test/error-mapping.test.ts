import { describe, expect, test } from "bun:test";
import { ERROR_STATUS } from "@yunpu/shared";
import { mapDatabaseError } from "../src/lib/errors";

test("ERROR_STATUS covers exactly eight codes", () => {
  expect(ERROR_STATUS.UNAVAILABLE).toBe(503);
  expect(Object.keys(ERROR_STATUS)).toHaveLength(8);
});

test("23001 and 23503 are distinct", () => {
  const restrict = mapDatabaseError({ code: "23001" });
  const fk = mapDatabaseError({ code: "23503" });
  expect(restrict.code).toBe("CONFLICT");
  expect(restrict.status).toBe(409);
  expect(restrict.message).not.toBe(fk.message);
});

test("named constraint still wins", () => {
  expect(mapDatabaseError({ code: "23503", constraint: "fk_organization_owner" }).message)
    .toBe("不能移除组织所有者");
});

test("22P02 is a validation error", () => {
  expect(mapDatabaseError({ code: "22P02" }).code).toBe("VALIDATION");
  expect(mapDatabaseError({ code: "22P02" }).status).toBe(400);
});

test("lock and cancellation timeouts are UNAVAILABLE 503", () => {
  for (const code of ["55P03", "57014"]) {
    const e = mapDatabaseError({ code });
    expect(e.code).toBe("UNAVAILABLE");
    expect(e.status).toBe(503);
  }
});

test("GX errors carry sqlstate for provisioning", () => {
  expect(mapDatabaseError({ code: "GX005" }).details?.sqlstate).toBe("GX005");
});

test("cause chain is unwrapped up to five levels", () => {
  expect(mapDatabaseError({ cause: { cause: { code: "23514" } } }).code).toBe("VALIDATION");
});

test("unknown code falls back to INTERNAL 500", () => {
  expect(mapDatabaseError({ code: "ZZZZZ" }).status).toBe(500);
});
