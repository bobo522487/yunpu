import { describe, expect, test } from "bun:test";
import { createLoginRateLimiter } from "../../apps/api/src/middleware/login-rate-limit";

describe("US2 login rate limit", () => {
  test("locks the email + source key after five failures", () => {
    let now = 1_000;
    const limiter = createLoginRateLimiter({
      now: () => now,
      windowMs: 15 * 60 * 1000,
      maxFailures: 5,
    });
    const key = "user@example.com|127.0.0.1";

    for (let index = 0; index < 5; index += 1) {
      limiter.recordFailure(key);
    }

    expect(limiter.check(key)).toBe(900);
  });

  test("releases the key after the fifteen minute window", () => {
    let now = 0;
    const limiter = createLoginRateLimiter({
      now: () => now,
      windowMs: 15 * 60 * 1000,
      maxFailures: 5,
    });
    const key = "user@example.com|127.0.0.1";

    for (let index = 0; index < 5; index += 1) {
      limiter.recordFailure(key);
    }
    expect(limiter.check(key)).not.toBeNull();

    now = 15 * 60 * 1000 + 1;
    expect(limiter.check(key)).toBeNull();
  });

  test("a successful login clears the counter", () => {
    const limiter = createLoginRateLimiter({ maxFailures: 5 });
    const key = "user@example.com|127.0.0.1";

    limiter.recordFailure(key);
    limiter.recordFailure(key);
    limiter.clear(key);

    expect(limiter.check(key)).toBeNull();
  });

  test("different source addresses do not share a counter", () => {
    const limiter = createLoginRateLimiter({ maxFailures: 5 });
    const email = "user@example.com";

    for (let index = 0; index < 5; index += 1) {
      limiter.recordFailure(`${email}|10.0.0.1`);
    }

    expect(limiter.check(`${email}|10.0.0.1`)).not.toBeNull();
    expect(limiter.check(`${email}|10.0.0.2`)).toBeNull();
  });
});
