import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context } from "hono";
import { AppError } from "../lib/errors";

type Entry = {
  failures: number;
  windowStart: number;
  lockedUntil: number;
  lockouts: number;
};

export type LoginRateLimiterOptions = {
  now?: () => number;
  windowMs?: number;
  maxFailures?: number;
  maxEntries?: number;
  escalating?: boolean;
};

export type LoginRateLimiter = {
  check: (key: string) => number | null;
  recordFailure: (key: string) => void;
  clear: (key: string) => void;
};

export function createLoginRateLimiter(
  options: LoginRateLimiterOptions = {},
): LoginRateLimiter {
  const now = options.now ?? Date.now;
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const maxFailures = options.maxFailures ?? 5;
  const maxEntries = options.maxEntries ?? 10_000;
  const escalating = options.escalating ?? false;
  const entries = new Map<string, Entry>();

  function evictIfNeeded() {
    while (entries.size >= maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) return;
      entries.delete(oldest);
    }
  }

  return {
    check(key) {
      const entry = entries.get(key);
      if (!entry) return null;

      const current = now();
      if (entry.lockedUntil > current) {
        return Math.max(1, Math.ceil((entry.lockedUntil - current) / 1000));
      }
      if (current - entry.windowStart >= windowMs) {
        if (escalating && entry.lockouts > 0) {
          entry.failures = 0;
          entry.windowStart = current;
          entry.lockedUntil = 0;
        } else {
          entries.delete(key);
        }
      }
      return null;
    },

    recordFailure(key) {
      const current = now();
      const entry = entries.get(key);
      if (!entry || current - entry.windowStart >= windowMs) {
        evictIfNeeded();
        entries.set(key, {
          failures: 1,
          windowStart: current,
          lockedUntil: 0,
          lockouts: entry?.lockouts ?? 0,
        });
        return;
      }

      entry.failures += 1;
      if (entry.failures >= maxFailures) {
        if (escalating) {
          entry.lockouts += 1;
          entry.lockedUntil =
            current + windowMs * 2 ** Math.min(entry.lockouts - 1, 3);
          entry.failures = 0;
          entry.windowStart = current;
        } else {
          entry.lockedUntil = entry.windowStart + windowMs;
        }
      }
    },

    clear(key) {
      entries.delete(key);
    },
  };
}

const WINDOW_MS = 15 * 60 * 1000;

/** Account + source key: five failures from one source lock that pair. */
export const loginRateLimiter = createLoginRateLimiter();

/** Per-source frequency ceiling, independent of the account being attacked. */
export const loginIpLimiter = createLoginRateLimiter({
  windowMs: WINDOW_MS,
  maxFailures: 50,
});

/** Per-account progressive backoff; survives a rotation of source addresses. */
export const loginAccountLimiter = createLoginRateLimiter({
  windowMs: WINDOW_MS,
  maxFailures: 20,
  escalating: true,
});

export function loginKey(email: string, sourceAddress: string): string {
  return `${email}|${sourceAddress}`;
}

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type LoginLimit = { limiter: LoginRateLimiter; key: string };

export function loginLimits(email: string, address: string): LoginLimit[] {
  return [
    { limiter: loginRateLimiter, key: loginKey(email, address) },
    { limiter: loginIpLimiter, key: `ip|${address}` },
    {
      limiter: loginAccountLimiter,
      key: `account|${normalizedEmail(email)}`,
    },
  ];
}

export function clearLoginRateLimits(email: string, address = "unknown"): void {
  for (const { limiter, key } of loginLimits(email, address)) {
    limiter.clear(key);
  }
}

/**
 * A forwarded header is trusted only when explicitly configured. Otherwise the
 * real socket peer is used, so a spoofed X-Forwarded-For cannot mint new keys.
 */
export function sourceAddress(c: Context): string {
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = c.req.header("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  }

  try {
    const incoming = (
      c as unknown as {
        env?: { incoming?: { socket?: { remoteAddress?: string } } };
      }
    ).env?.incoming;
    if (incoming?.socket?.remoteAddress) return incoming.socket.remoteAddress;

    const address = getConnInfo(c).remote.address;
    return address && address.length > 0 ? address : "unknown";
  } catch {
    // Unit tests and non-node adapters may not expose a socket.
    return "unknown";
  }
}

export function assertLoginAllowed(
  limiter: LoginRateLimiter,
  key: string,
): void {
  const retryAfterSeconds = limiter.check(key);
  if (retryAfterSeconds !== null) {
    throw new AppError("RATE_LIMITED", "请求过于频繁，请稍后重试", 429, {
      retryAfterSeconds,
    });
  }
}
