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

export function logEvent(fields: LogFields): void {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    safe[key] = typeof value === "string" ? redact(value) : value;
  }
  console.log(JSON.stringify(safe));
}
