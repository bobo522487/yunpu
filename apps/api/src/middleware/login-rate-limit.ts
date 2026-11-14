import type { Context } from "hono";
import { getConnInfo } from "hono/bun";
import { AppError } from "../lib/errors";

type Entry = {
  failures: number;
  windowStart: number;
  lockedUntil: number;
};

export type LoginRateLimiterOptions = {
  now?: () => number;
  windowMs?: number;
  maxFailures?: number;
  maxEntries?: number;
};

export type LoginRateLimiter = {
  check: (key: string) => number | null;
  recordFailure: (key: string) => void;
  clear: (key: string) => void;
};

export function createLoginRateLimiter(options: LoginRateLimiterOptions = {}): LoginRateLimiter {
  const now = options.now ?? Date.now;
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const maxFailures = options.maxFailures ?? 5;
  const maxEntries = options.maxEntries ?? 10_000;
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
        entries.delete(key);
      }
      return null;
    },

    recordFailure(key) {
      const current = now();
      const entry = entries.get(key);
      if (!entry || current - entry.windowStart >= windowMs) {
        evictIfNeeded();
        entries.set(key, { failures: 1, windowStart: current, lockedUntil: 0 });
        return;
      }

      entry.failures += 1;
      if (entry.failures >= maxFailures) {
        entry.lockedUntil = entry.windowStart + windowMs;
      }
    },

    clear(key) {
      entries.delete(key);
    },
  };
}

export const loginRateLimiter = createLoginRateLimiter();

export function loginKey(email: string, sourceAddress: string): string {
  return `${email}|${sourceAddress}`;
}

export function sourceAddress(c: Context): string {
  try {
    const info = getConnInfo(c);
    if (info.remote.address) return info.remote.address;
  } catch {
    // app.request() has no socket; fall through to the proxy header.
  }

  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return "unknown";
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
