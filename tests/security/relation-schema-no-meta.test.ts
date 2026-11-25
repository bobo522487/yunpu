import { describe, expect, test } from "vitest";
import { CreateRelationSchema } from "../../packages/shared/src/schemas";

const validInput = {
  fromPersonId: "0199a4d0-7c00-7000-8000-000000000001",
  toPersonId: "0199a4d0-7c00-7000-8000-000000000002",
  kind: "biological_parent",
};

describe("CreateRelationSchema", () => {
  test("does not advertise an unpersisted meta field", () => {
    const shape = CreateRelationSchema.safeParse(validInput);
    expect(shape.success).toBe(true);
    if (!shape.success) return;
    expect(Object.keys(shape.data)).not.toContain("meta");
  });

  test("rejects a meta field instead of silently dropping it", () => {
    const result = CreateRelationSchema.safeParse({
      ...validInput,
      meta: { note: "ignored" },
    });
    expect(result.success).toBe(false);
  });
});
