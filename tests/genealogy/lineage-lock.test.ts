import { Client } from "pg";
import { describe, expect, test } from "vitest";
import { withAdminDb } from "../auth/fixtures";
import {
  createPerson,
  createRelation,
  seedOwnerProject,
} from "./fixtures/helpers";

function adminClient(): Client {
  return new Client({ connectionString: process.env.MIGRATE_DATABASE_URL });
}

const projectLockKey = (projectId: string) => `yunpu:relation:${projectId}`;

async function probeProjectLock(projectId: string): Promise<boolean> {
  const probe = adminClient();
  await probe.connect();
  try {
    const result = await probe.query<{ held: boolean }>(
      `SELECT NOT pg_try_advisory_xact_lock(hashtextextended($1::text, 0)) AS held`,
      [projectLockKey(projectId)],
    );
    return result.rows[0].held;
  } finally {
    await probe.end();
  }
}

describe("lineage projection lock coverage (genealogy)", () => {
  test("deleting a lineage edge holds the project advisory lock", async () => {
    const { cookie, projectId } = await seedOwnerProject("lock-del");
    const parent = await createPerson(cookie, projectId, {
      displayName: "父",
    });
    const child = await createPerson(cookie, projectId, {
      displayName: "子",
    });
    const relation = await createRelation(cookie, projectId, {
      fromPersonId: (parent.data?.person as { id: string }).id,
      toPersonId: (child.data?.person as { id: string }).id,
      kind: "biological_parent",
    });
    const relationId = (relation.data?.relation as { id: string }).id;

    const holder = adminClient();
    await holder.connect();
    try {
      await holder.query("BEGIN");
      await holder.query("DELETE FROM person_relation WHERE id = $1", [
        relationId,
      ]);
      expect(await probeProjectLock(projectId)).toBe(true);
      await holder.query("ROLLBACK");
    } finally {
      await holder.query("ROLLBACK").catch(() => undefined);
      await holder.end();
    }
  });

  test("downgrading a lineage edge also holds the project advisory lock", async () => {
    const { cookie, projectId } = await seedOwnerProject("lock-downgrade");
    const parent = await createPerson(cookie, projectId, {
      displayName: "父",
    });
    const child = await createPerson(cookie, projectId, {
      displayName: "子",
    });
    const relation = await createRelation(cookie, projectId, {
      fromPersonId: (parent.data?.person as { id: string }).id,
      toPersonId: (child.data?.person as { id: string }).id,
      kind: "biological_parent",
    });
    const relationId = (relation.data?.relation as { id: string }).id;

    const holder = adminClient();
    await holder.connect();
    try {
      await holder.query("BEGIN");
      await holder.query(
        "UPDATE person_relation SET kind = 'step_parent' WHERE id = $1",
        [relationId],
      );
      expect(await probeProjectLock(projectId)).toBe(true);
      await holder.query("ROLLBACK");
    } finally {
      await holder.query("ROLLBACK").catch(() => undefined);
      await holder.end();
    }
  });

  test("an unchanged lineage rebuild produces no new row versions", async () => {
    const { cookie, projectId } = await seedOwnerProject("lock-noop");
    const parent = await createPerson(cookie, projectId, {
      displayName: "父",
    });
    const child = await createPerson(cookie, projectId, {
      displayName: "子",
    });
    await createRelation(cookie, projectId, {
      fromPersonId: (parent.data?.person as { id: string }).id,
      toPersonId: (child.data?.person as { id: string }).id,
      kind: "biological_parent",
    });

    await withAdminDb(async (client) => {
      await client.query("SELECT app.rebuild_project_lineage($1)", [projectId]);
      const before = await client.query<{ xmin: string; updated_at: Date }>(
        `SELECT xmin::text, updated_at FROM lineage_projection WHERE project_id = $1`,
        [projectId],
      );
      expect(before.rows.length).toBeGreaterThan(0);

      await client.query("SELECT pg_sleep(0.02)");
      await client.query("SELECT app.rebuild_project_lineage($1)", [projectId]);
      const after = await client.query<{ xmin: string; updated_at: Date }>(
        `SELECT xmin::text, updated_at FROM lineage_projection WHERE project_id = $1`,
        [projectId],
      );

      expect(after.rows).toEqual(before.rows);
    });
  });
});
