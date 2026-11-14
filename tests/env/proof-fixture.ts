import { Client } from "../../apps/api/node_modules/pg/esm/index.mjs";

// The proof fixture lives on the real test database only for the duration of
// one test run. The owner role (image superuser) creates it; genealogy_app,
// which is NOSUPERUSER NOBYPASSRLS, then sees only its own tenant's rows.
// Every teardown path drops it, including failures.

const ownerUrl = process.env.PROOF_OWNER_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5433/yunpu_test";
const appUrl = process.env.DATABASE_URL ?? "postgres://genealogy_app:example@127.0.0.1:5433/yunpu_test";

async function connect(url: string) {
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
  });
  await client.connect();
  return client;
}

export async function withProofFixture(
  run: (appClient: Client, ownerClient: Client) => Promise<void>,
): Promise<void> {
  const owner = await connect(ownerUrl);
  let app: Client | undefined;
  try {
    await owner.query("DROP TABLE IF EXISTS proof_tenant_isolation");
    await owner.query(`
      CREATE TABLE proof_tenant_isolation (
        tenant_id text NOT NULL,
        payload text NOT NULL
      )
    `);
    await owner.query("ALTER TABLE proof_tenant_isolation ENABLE ROW LEVEL SECURITY");
    await owner.query("ALTER TABLE proof_tenant_isolation FORCE ROW LEVEL SECURITY");
    await owner.query(`
      CREATE POLICY proof_tenant_isolation_tenant ON proof_tenant_isolation
        USING (tenant_id = current_setting('app.tenant_id', true))
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true))
    `);
    // genealogy_app is not the owner and the table is not world-readable;
    // row security filters rows only after privileges allow the touch.
    await owner.query("GRANT SELECT, INSERT, DELETE ON proof_tenant_isolation TO genealogy_app");

    app = await connect(appUrl);
    await run(app, owner);
  } finally {
    if (app) {
      await app.end().catch(() => undefined);
    }
    await owner.query("DROP TABLE IF EXISTS proof_tenant_isolation").catch(() => undefined);
    await owner.end().catch(() => undefined);
  }
}
