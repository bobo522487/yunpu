import { expect, test } from "bun:test";
import { withProofFixture } from "./proof-fixture.ts";

// These tests refuse to skip. They run against the real test environment
// (project yunpu-test, ports 3010/5433/9010). When that environment is down,
// they fail — the isolation proof must land on a real PostgreSQL 18.

const appBase = "http://127.0.0.1:3010";
const devToken = process.env.DEV_YUNPU_CAPABILITY_TOKEN ?? "example-development-capability-token";
const testToken = process.env.YUNPU_CAPABILITY_TOKEN ?? "example-test-capability-token";

test("the test database is PostgreSQL 18", async () => {
  const { Client } = await import("../../apps/api/node_modules/pg/esm/index.mjs");
  const client = new Client({
    connectionString: process.env.DATABASE_URL ?? "postgres://genealogy_app:example@127.0.0.1:5433/yunpu_test",
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  try {
    const result = await client.query<{ version: string }>("SELECT version()");
    expect(result.rows[0]?.version).toContain("PostgreSQL 18");
  } finally {
    await client.end();
  }
});

test("row security keeps genealogy_app inside its tenant", async () => {
  await withProofFixture(async (appClient) => {
    // Row security is forced, so every write must satisfy the policy's
    // WITH CHECK: seed each tenant under its own session context.
    await appClient.query("SET app.tenant_id = 'tenant-a'");
    await appClient.query("INSERT INTO proof_tenant_isolation (tenant_id, payload) VALUES ('tenant-a', 'a-row')");
    await appClient.query("SET app.tenant_id = 'tenant-b'");
    await appClient.query("INSERT INTO proof_tenant_isolation (tenant_id, payload) VALUES ('tenant-b', 'b-row')");
    await appClient.query("SET app.tenant_id = 'tenant-a'");

    // No tenant filter: row security alone must limit the result.
    const rows = await appClient.query<{ tenant_id: string; payload: string }>(
      "SELECT tenant_id, payload FROM proof_tenant_isolation",
    );
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0]?.tenant_id).toBe("tenant-a");
    expect(rows.rows[0]?.payload).toBe("a-row");
  });
});

test("a direct unauthenticated object read is not HTTP 200", async () => {
  // Write a known object through the app first.
  const written = await fetch(`${appBase}/api/media`, {
    method: "POST",
    headers: { authorization: `Bearer ${testToken}` },
    body: "bypass-check-bytes",
  });
  expect(written.status).toBe(201);
  const { key } = (await written.json()) as { key: string };
  expect(key.length).toBeGreaterThan(0);

  // Anonymous read straight from MinIO: the bucket stays private.
  const storageEndpoint = process.env.DEV_S3_ENDPOINT_TEST ?? "http://127.0.0.1:9010";
  const direct = await fetch(`${storageEndpoint}/${process.env.S3_BUCKET ?? "yunpu-test"}/${key}`);
  expect(direct.status).not.toBe(200);
  expect(await direct.text()).not.toContain("bypass-check-bytes");
});

test("the development token is rejected by the test environment", async () => {
  const wrongToken = await fetch(`${appBase}/api/media`, {
    method: "POST",
    headers: { authorization: `Bearer ${devToken}` },
    body: "cross-env-payload",
  });
  expect(wrongToken.status).toBe(401);

  const noToken = await fetch(`${appBase}/api/media`, { method: "POST", body: "no-token" });
  expect(noToken.status).toBe(401);
});
