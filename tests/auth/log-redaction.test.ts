import { describe, expect, test } from "bun:test";
import { PASSWORD, signIn, signUp, uniqueEmail } from "./fixtures";

describe("secret redaction", () => {
  test("registration and login responses do not echo the password", async () => {
    const email = uniqueEmail("redact");
    const registered = await signUp(email);
    const signedIn = await signIn(email);

    expect(JSON.stringify(registered.json).includes(PASSWORD)).toBe(false);
    expect(JSON.stringify(signedIn.json).includes(PASSWORD)).toBe(false);
  });

  test("an invite token is not echoed in the response body", async () => {
    const token = "redact-invite-token-123";
    const registered = await signUp(uniqueEmail("redact-invite"), {
      inviteToken: token,
    });
    expect(JSON.stringify(registered.json).includes(token)).toBe(false);
  });
});
