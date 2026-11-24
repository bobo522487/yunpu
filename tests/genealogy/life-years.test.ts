import { describe, expect, test } from "vitest";
import { withAdminDb } from "../auth/fixtures";
import { createPerson, seedOwnerProject } from "./fixtures/helpers";

describe("person life years", () => {
  test("death year on a living person is a check violation", async () => {
    const { organizationId, projectId, cookie } =
      await seedOwnerProject("life-years");

    await expect(
      withAdminDb((client) =>
        client.query(
          `INSERT INTO person (organization_id, project_id, sex, birth_year, death_year, is_living)
           VALUES ($1, $2, 'unknown', 1900, 1950, true)`,
          [organizationId, projectId],
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
});
