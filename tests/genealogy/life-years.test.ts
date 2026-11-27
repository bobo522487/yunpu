import { describe, expect, test } from "vitest";
import { withAdminDb } from "../auth/fixtures";
import { createPerson, seedOwnerProject } from "./fixtures/helpers";

async function createTestLineage(
  organizationId: string,
  projectId: string,
): Promise<string> {
  return withAdminDb(async (client) => {
    const rows = await client.query<{ id: string }>(
      `INSERT INTO lineage (organization_id, project_id, name)
       VALUES ($1::uuid, $2::uuid, '主世系')
       RETURNING id`,
      [organizationId, projectId],
    );
    return rows.rows[0].id;
  });
}

describe("person life years", () => {
  test("death year on a living person is a check violation", async () => {
    const { organizationId, projectId, cookie } =
      await seedOwnerProject("life-years");
    const lineageId = await createTestLineage(organizationId, projectId);

    await expect(
      withAdminDb((client) =>
        client.query(
          `INSERT INTO person (organization_id, project_id, lineage_id, sex, birth_year, death_year, is_living)
           VALUES ($1, $2, $3, 'unknown', 1900, 1950, true)`,
          [organizationId, projectId, lineageId],
        ),
      ),
    ).rejects.toMatchObject({
      code: "23514",
      constraint: "ck_person_life_years",
    });

    const created = await createPerson(cookie, projectId, {
      displayName: "在世却有卒年",
      birthYear: 1900,
      deathYear: 1950,
      isLiving: true,
    });
    expect(created.status).toBe(400);
    expect(created.json.code).toBe("VALIDATION");
    expect(created.json.message).toBe("年份与在世状态不一致");
  });

  test("death year before birth year is rejected and the stored row stays", async () => {
    const { organizationId, projectId, cookie } =
      await seedOwnerProject("life-years-order");
    const lineageId = await createTestLineage(organizationId, projectId);
    await withAdminDb((client) =>
      client.query(
        `INSERT INTO person (organization_id, project_id, lineage_id, sex, birth_year, is_living)
         VALUES ($1, $2, $3, 'unknown', 1920, true)`,
        [organizationId, projectId, lineageId],
      ),
    );

    await expect(
      withAdminDb((client) =>
        client.query(
          `UPDATE person
              SET death_year = 1900, is_living = true
            WHERE organization_id = $1 AND project_id = $2`,
          [organizationId, projectId],
        ),
      ),
    ).rejects.toMatchObject({
      code: "23514",
      constraint: "ck_person_life_years",
    });

    const stored = await withAdminDb((client) =>
      client.query<{
        birth_year: number;
        death_year: number | null;
        is_living: boolean;
      }>(
        `SELECT birth_year, death_year, is_living
           FROM person
          WHERE organization_id = $1 AND project_id = $2`,
        [organizationId, projectId],
      ),
    );
    expect(stored.rows).toEqual([
      { birth_year: 1920, death_year: null, is_living: true },
    ]);

    const created = await createPerson(cookie, projectId, {
      displayName: "卒年早于生年",
      birthYear: 1950,
      deathYear: 1900,
      isLiving: false,
    });
    expect(created.status).toBe(400);
    expect(created.json.code).toBe("VALIDATION");
    expect(created.json.message).toBe("年份与在世状态不一致");
  });

  test("birth year alone, or a death with an unknown year, is allowed", async () => {
    const { organizationId, projectId } =
      await seedOwnerProject("life-years-allow");
    const lineageId = await createTestLineage(organizationId, projectId);

    const birthOnly = await withAdminDb((client) =>
      client.query(
        `INSERT INTO person (organization_id, project_id, lineage_id, sex, birth_year, is_living)
         VALUES ($1, $2, $3, 'unknown', 1930, true)
         RETURNING id`,
        [organizationId, projectId, lineageId],
      ),
    );
    const unknownDeath = await withAdminDb((client) =>
      client.query(
        `INSERT INTO person (organization_id, project_id, lineage_id, sex, is_living)
         VALUES ($1, $2, $3, 'unknown', false)
         RETURNING id`,
        [organizationId, projectId, lineageId],
      ),
    );
    expect(birthOnly.rows).toHaveLength(1);
    expect(unknownDeath.rows).toHaveLength(1);
  });
});
