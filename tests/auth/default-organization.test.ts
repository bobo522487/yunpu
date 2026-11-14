import { describe, expect, test } from "bun:test";
import {
  activateOrganization,
  createOrganization,
  listOrganizations,
  readSession,
  setOrganizationStatus,
  signIn,
  signUp,
  uniqueEmail,
  withAdminDb,
} from "./fixtures";

describe("US4 default organization", () => {
  test("uses the last used active organization across devices", async () => {
    const email = uniqueEmail("multi");
    const registered = await signUp(email);
    const personal = registered.json.data?.defaultOrganization as { id: string; name: string };

    const created = await createOrganization(registered.cookie, "第二组织");
    const second = created.data?.organization as { id: string };

    const activated = await activateOrganization(registered.cookie, second.id);
    expect(activated.response.status).toBe(200);

    const otherDevice = await signIn(email);
    expect((otherDevice.json.data?.defaultOrganization as { id: string }).id).toBe(second.id);
    expect((otherDevice.json.data?.defaultOrganization as { id: string }).id).not.toBe(
      personal.id,
    );
  });

  test("falls back to the earliest joined active organization", async () => {
    const email = uniqueEmail("fallback");
    const registered = await signUp(email);
    const personal = registered.json.data?.defaultOrganization as { id: string };
    const userId = (registered.json.data?.user as { id: string }).id;

    const created = await createOrganization(registered.cookie, "后创建的组织");
    const later = created.data?.organization as { id: string };

    await withAdminDb((client) =>
      client.query(
        "UPDATE organization_member SET last_used_at = NULL WHERE organization_id = $1 AND user_id = $2",
        [later.id, userId],
      ),
    );

    const freshLogin = await signIn(email);
    expect((freshLogin.json.data?.defaultOrganization as { id: string }).id).toBe(personal.id);
  });

  test("skips archived organizations and enters onboarding when none are active", async () => {
    const email = uniqueEmail("archived");
    const registered = await signUp(email);
    const personal = registered.json.data?.defaultOrganization as { id: string };

    await setOrganizationStatus(personal.id, "archived");
    const afterArchive = await signIn(email);
    expect(afterArchive.json.data?.defaultOrganization).toBeNull();
    expect(afterArchive.json.data?.onboarding).toBe(true);

    const session = await readSession(afterArchive.cookie);
    expect(session.data?.onboarding).toBe(true);
  });

  test("lists only active organizations", async () => {
    const email = uniqueEmail("list");
    const registered = await signUp(email);
    const personal = registered.json.data?.defaultOrganization as { id: string };

    const created = await createOrganization(registered.cookie, "保留组织");
    const kept = created.data?.organization as { id: string };
    await setOrganizationStatus(personal.id, "archived");

    const listed = await listOrganizations(registered.cookie);
    const organizations = listed.data?.organizations as { id: string }[];
    expect(organizations.map((item) => item.id)).toEqual([kept.id]);
    expect(listed.data?.defaultOrganizationId).toBe(kept.id);
  });

  test("activating a foreign or archived organization returns not found", async () => {
    const owner = uniqueEmail("owner");
    const stranger = uniqueEmail("stranger");
    const ownerSignUp = await signUp(owner);
    await signUp(stranger);

    const foreign = await activateOrganization(
      ownerSignUp.cookie,
      "01900000-0000-7000-8000-000000000099",
    );
    expect(foreign.response.status).toBe(404);
    expect(foreign.json.code).toBe("NOT_FOUND");
  });
});
