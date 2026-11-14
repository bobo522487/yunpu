-- Proof fixture for the tenant-isolation check. Created by the owner role
-- (the image superuser), dropped again when the test ends. Never a migration.
CREATE TABLE proof_tenant_isolation (
  tenant_id text NOT NULL,
  payload text NOT NULL
);

ALTER TABLE proof_tenant_isolation ENABLE ROW LEVEL SECURITY;
ALTER TABLE proof_tenant_isolation FORCE ROW LEVEL SECURITY;

CREATE POLICY proof_tenant_isolation_tenant ON proof_tenant_isolation
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, DELETE ON proof_tenant_isolation TO genealogy_app;
