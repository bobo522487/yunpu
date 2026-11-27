export type LogFields = {
  event: string;
  request_id?: string;
  user_id?: string;
  organization_id?: string;
  result?: string;
  reason?: string;
  [key: string]: unknown;
};

// One place that knows what a secret looks like. Callers must never be trusted
// to redact their own fields: a raw error.message is enough to leak a password.
export function redact(text: string): string {
  let out = text;
  // URL userinfo: postgres://user:password@host
  out = out.replace(
    /\b([a-z][a-z0-9+.-]*:\/\/)([^\s/@:]+):([^\s/@]+)@/gi,
    "$1[REDACTED]@",
  );
  // Bearer credentials, including the trailing token after a colon.
  out = out.replace(/\bBearer\s+[^\s,;}"']+/gi, "Bearer [REDACTED]");
  // key =/: value, with optional quotes around either side (plain, JSON, CSV).
  out = out.replace(
    /("?\b(?:password|token|secret|authorization)\b"?\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s,;}&"']+)/gi,
    "$1[REDACTED]",
  );
  return out;
}

function redactValue(
  value: unknown,
  seen = new WeakSet<object>(),
  depth = 0,
): unknown {
  if (typeof value === "string") {
    return redact(value);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (depth >= 6) {
    return "[TRUNCATED]";
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redact(value.message),
      ...(value.stack ? { stack: redact(value.stack) } : {}),
    };
  }
  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) {
      out[key] = redactValue(item, seen, depth + 1);
    }
  }
  return out;
}

export function logEvent(fields: LogFields): void {
  const safe: Record<string, unknown> = { ts: new Date().toISOString() };
  const seen = new WeakSet<object>();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      safe[key] = redactValue(value, seen);
    }
  }
  console.log(JSON.stringify(safe));
}
