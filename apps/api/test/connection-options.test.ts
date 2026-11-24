import { expect, test } from "vitest";
import { PG_OPTIONS } from "@yunpu/db";

test("PG_OPTIONS carries the three mandated timeouts verbatim", () => {
  expect(PG_OPTIONS).toBe(
    "-c lock_timeout=3000 -c statement_timeout=30000 -c idle_in_transaction_session_timeout=60000",
  );
});
